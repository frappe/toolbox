# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Staged-import engine for the bundled GeoNames city dataset.

Mirrors the PIN/IFSC/HSN/Dictionary engines: stage a complete local file, validate it, and
atomically activate it, keeping the previous release for fast rollback. The dataset is
GeoNames `cities15000` joined to country and region names, so Weather geocodes from local
data instead of calling a third-party geocoder.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from collections.abc import Iterable, Mapping
from pathlib import Path

import frappe
from frappe.utils import now_datetime

from toolbox.india_business_data import RELEASE_DOCTYPE, file_sha256

DATASET_TYPE = "City"
CITY_DOCTYPE = "Toolbox City Record"
BATCH_SIZE = 5_000
CITY_SOURCE = {
	"source_name": "GeoNames cities15000",
	"source_url": "https://download.geonames.org/export/dump/",
	"license_name": "CC BY 4.0",
	"license_url": "https://creativecommons.org/licenses/by/4.0/",
	"attribution": "City data from GeoNames, licensed under CC BY 4.0.",
}


def import_city_jsonl(path: str, version: str, source_updated_at: str) -> dict[str, object]:
	"""Stage, validate, and atomically activate one complete local city dataset."""
	_validate_arguments(version, source_updated_at)
	file_path = Path(path).resolve(strict=True)
	checksum = file_sha256(file_path)
	with frappe.db.advisory_lock("toolbox:city-dataset-import", timeout=30):
		return _import_jsonl_locked(file_path, checksum, version, source_updated_at)


def search_name(value: str) -> str:
	"""Fold a city name for search: strip accents and case so "Zurich" finds "Zürich"."""
	decomposed = unicodedata.normalize("NFKD", str(value or ""))
	return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold().strip()


def normalize_city_row(row: Mapping[str, object] | None) -> dict[str, object] | None:
	if row is None:
		return None
	geoname_id = _positive_int(row.get("id"))
	city_name = _text(row.get("name"))
	latitude = _coordinate(row.get("latitude"), 90.0)
	longitude = _coordinate(row.get("longitude"), 180.0)
	if not geoname_id or not city_name or latitude is None or longitude is None:
		return None
	return {
		"geoname_id": geoname_id,
		"city_name": city_name,
		"search_name": search_name(city_name),
		"country": _text(row.get("country")),
		"country_code": _text(row.get("country_code")).upper()[:2],
		"admin1": _text(row.get("admin1")),
		"latitude": latitude,
		"longitude": longitude,
		"timezone": _text(row.get("timezone")),
		"population": _positive_int(row.get("population")) or 0,
	}


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
			continue
		normalized = normalize_city_row(_parse_line(stripped))
		if normalized is None:
			exclusion_count += 1
			continue
		geoname_id = normalized["geoname_id"]
		if geoname_id in seen:
			duplicate_count += 1
			continue
		seen.add(geoname_id)
		record_key = f"{release_name}:{geoname_id}"
		batch.append({
			"name": hashlib.sha256(record_key.encode()).hexdigest()[:40],
			"dataset_release": release_name,
			**normalized,
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


def _import_jsonl_locked(
	file_path: Path,
	checksum: str,
	version: str,
	source_updated_at: str,
) -> dict[str, object]:
	release_key = f"city:{checksum}"
	existing = frappe.db.get_value(RELEASE_DOCTYPE, release_key, ["name", "status"], as_dict=True)
	if existing:
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
		frappe.db.commit()
		raise

	return _release_payload(release.name)


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
		"source_name": CITY_SOURCE["source_name"],
		"source_url": CITY_SOURCE["source_url"],
		"license_name": CITY_SOURCE["license_name"],
		"license_url": CITY_SOURCE["license_url"],
		"attribution": CITY_SOURCE["attribution"],
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
	# Retain rows for the new active release and the generation it just superseded;
	# drop older ones.
	_prune_superseded_rows(keep=set(previous_active))


def _prune_superseded_rows(keep: set[str]) -> None:
	superseded = frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"dataset_type": DATASET_TYPE, "status": "Superseded"},
		pluck="name",
	)
	for name in superseded:
		if name not in keep:
			frappe.db.delete(CITY_DOCTYPE, {"dataset_release": name})


def _bulk_insert(rows: list[dict[str, object]]) -> None:
	fields = list(rows[0])
	frappe.db.bulk_insert(CITY_DOCTYPE, fields, ([row[field] for field in fields] for row in rows))


def _delete_release_rows(release_name: str) -> None:
	frappe.db.delete(CITY_DOCTYPE, {"dataset_release": release_name})


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


def _positive_int(value: object) -> int | None:
	try:
		number = int(value)
	except (TypeError, ValueError):
		return None
	return number if number >= 0 else None


def _coordinate(value: object, bound: float) -> float | None:
	try:
		number = float(value)
	except (TypeError, ValueError):
		return None
	return number if -bound <= number <= bound else None
