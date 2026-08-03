import hashlib
import json
from collections.abc import Iterable, Mapping
from pathlib import Path

import frappe
from frappe.utils import now_datetime

from toolbox.india_business_data import RELEASE_DOCTYPE, file_sha256

DATASET_TYPE = "Dictionary"
DICTIONARY_DOCTYPE = "Toolbox Dictionary Entry"
BATCH_SIZE = 5_000
WORDNET_SOURCE = {
	"source_name": "Princeton University WordNet 3.1",
	"source_url": "https://wordnet.princeton.edu/",
	"license_name": "WordNet License",
	"license_url": "https://wordnet.princeton.edu/license-and-commercial-use",
	"attribution": "WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved.",
}


def import_dictionary_jsonl(path: str, version: str, source_updated_at: str) -> dict[str, object]:
	"""Stage, validate, and atomically activate one complete local dictionary dataset."""
	_validate_arguments(version, source_updated_at)
	file_path = Path(path).resolve(strict=True)
	checksum = file_sha256(file_path)
	with frappe.db.advisory_lock("toolbox:dictionary-dataset-import", timeout=30):
		return _import_jsonl_locked(file_path, checksum, version, source_updated_at)


def _import_jsonl_locked(
	file_path: Path,
	checksum: str,
	version: str,
	source_updated_at: str,
) -> dict[str, object]:
	release_key = f"dictionary:{checksum}"
	existing = frappe.db.get_value(RELEASE_DOCTYPE, release_key, ["name", "status"], as_dict=True)
	if existing:
		# Idempotent by dataset type + checksum: an already-imported dataset is returned
		# as-is. A Superseded release is never reactivated here — re-running an old import
		# command must not demote a newer Active release. Only an incomplete prior attempt
		# (Staged/Failed) is cleared and retried.
		if existing.status in ("Active", "Superseded"):
			return _release_payload(existing.name)
		_delete_release_rows(existing.name)
		frappe.delete_doc(RELEASE_DOCTYPE, existing.name, ignore_permissions=True)

	release = _create_release(release_key, checksum, version, source_updated_at)
	try:
		with file_path.open(encoding="utf-8") as source:
			result = stage_rows(source, release.name)
		if not result["record_count"]:
			raise ValueError("The dataset contains no valid records.")
		_activate_release(release.name, result)
	except Exception as error:
		_delete_release_rows(release.name)
		frappe.db.set_value(RELEASE_DOCTYPE, release.name, {
			"status": "Failed",
			"failure_reason": str(error)[:500],
			"imported_at": now_datetime(),
		})
		# Commit the failure marker (and the staged-row cleanup) so it survives the
		# rollback the caller performs when the re-raised exception propagates. The
		# active release from any prior import lives in its own committed transaction.
		frappe.db.commit()
		raise

	return _release_payload(release.name)


def stage_rows(lines: Iterable[str], release_name: str) -> dict[str, int]:
	"""Parse each JSONL line, normalize it, and bulk-insert deduplicated records."""
	seen = set()
	batch = []
	record_count = 0
	exclusion_count = 0
	duplicate_count = 0

	for line in lines:
		stripped = line.strip()
		if not stripped:
			# Blank separator lines carry no record and are not counted.
			continue
		normalized = normalize_dictionary_row(_parse_line(stripped))
		if normalized is None:
			# Line is unparseable, or lacks a word or any senses (an exclusion).
			exclusion_count += 1
			continue
		business_key = normalized["business_key"]
		if business_key in seen:
			# The same normalized word appeared earlier in this file.
			duplicate_count += 1
			continue
		seen.add(business_key)
		# The release-scoped key derives a stable unique name; it is not stored as a
		# column (redundant with name).
		record_key = f"{release_name}:{business_key}"
		batch.append({
			"name": hashlib.sha256(record_key.encode()).hexdigest()[:40],
			"dataset_release": release_name,
			**{key: value for key, value in normalized.items() if key != "business_key"},
		})
		if len(batch) == BATCH_SIZE:
			_bulk_insert(batch)
			record_count += len(batch)
			batch = []

	if batch:
		_bulk_insert(batch)
		record_count += len(batch)
	return {
		"record_count": record_count,
		"exclusion_count": exclusion_count,
		"duplicate_count": duplicate_count,
	}


def normalize_dictionary_row(row: Mapping[str, object] | None) -> dict[str, str] | None:
	if row is None:
		return None
	word = _text(row.get("word"))
	senses = row.get("senses")
	if not word or not isinstance(senses, list) or not senses:
		return None

	normalized_word = word.casefold()
	return {
		"business_key": normalized_word,
		"word": word,
		"normalized_word": normalized_word,
		"senses_json": json.dumps(senses),
	}


def _parse_line(line: str) -> Mapping[str, object] | None:
	try:
		value = json.loads(line)
	except json.JSONDecodeError:
		return None
	return value if isinstance(value, Mapping) else None


def _create_release(release_key: str, checksum: str, version: str, source_updated_at: str):
	return frappe.get_doc({
		"doctype": RELEASE_DOCTYPE,
		"release_key": release_key,
		"dataset_type": DATASET_TYPE,
		"status": "Staged",
		"source_name": WORDNET_SOURCE["source_name"],
		"source_url": WORDNET_SOURCE["source_url"],
		"license_name": WORDNET_SOURCE["license_name"],
		"license_url": WORDNET_SOURCE["license_url"],
		"attribution": WORDNET_SOURCE["attribution"],
		"version": version,
		"source_updated_at": source_updated_at,
		"checksum": checksum,
	}).insert(ignore_permissions=True)


def _activate_release(release_name: str, result: dict[str, int]) -> None:
	frappe.db.get_value(RELEASE_DOCTYPE, release_name, "name", for_update=True)
	previous_active = frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"dataset_type": DATASET_TYPE, "status": "Active"},
		pluck="name",
	)
	for active_name in previous_active:
		frappe.db.set_value(RELEASE_DOCTYPE, active_name, "status", "Superseded")
	frappe.db.set_value(RELEASE_DOCTYPE, release_name, {
		"status": "Active",
		"record_count": result["record_count"],
		"exclusion_count": result["exclusion_count"],
		"duplicate_count": result["duplicate_count"],
		"imported_at": now_datetime(),
		"failure_reason": "",
	})
	# Retain rows for the new active release and the generation it just superseded
	# (the immediately-previous release, kept for fast rollback); drop older ones.
	_prune_superseded_rows(keep=set(previous_active))


def _prune_superseded_rows(keep: set[str]) -> None:
	superseded = frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"dataset_type": DATASET_TYPE, "status": "Superseded"},
		pluck="name",
	)
	for name in superseded:
		if name not in keep:
			# Release metadata row stays for history; only its bulky record rows go.
			frappe.db.delete(DICTIONARY_DOCTYPE, {"dataset_release": name})


def _bulk_insert(rows: list[dict[str, str]]) -> None:
	fields = list(rows[0])
	frappe.db.bulk_insert(DICTIONARY_DOCTYPE, fields, ([row[field] for field in fields] for row in rows))


def _delete_release_rows(release_name: str) -> None:
	frappe.db.delete(DICTIONARY_DOCTYPE, {"dataset_release": release_name})


def _release_payload(name: str) -> dict[str, object]:
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		name,
		["name", "dataset_type", "status", "version", "source_updated_at", "imported_at", "checksum", "record_count", "exclusion_count", "duplicate_count"],
		as_dict=True,
	)


def _validate_arguments(version: str, source_updated_at: str) -> None:
	if not _text(version):
		raise ValueError("Missing dataset metadata: version.")
	if not _text(source_updated_at):
		raise ValueError("Missing dataset metadata: source_updated_at.")


def _text(value: object) -> str:
	return " ".join(str(value or "").strip().split())
