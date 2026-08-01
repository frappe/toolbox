import csv
import hashlib
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import frappe
from frappe.utils import now_datetime

DatasetType = Literal["PIN", "IFSC"]
RELEASE_DOCTYPE = "Toolbox Dataset Release"
PIN_DOCTYPE = "Toolbox PIN Record"
IFSC_DOCTYPE = "Toolbox IFSC Record"
BATCH_SIZE = 5_000
PIN_SOURCE = {
	"source_name": "Department of Posts, Government of India via data.gov.in",
	"source_url": "https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice",
	"license_name": "Government Open Data License - India",
	"license_url": "https://www.data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf",
	"attribution": "Source: Department of Posts, Government of India, published through data.gov.in under the Government Open Data License - India.",
}
IFSC_SOURCE = {
	"source_name": "Razorpay IFSC dataset derived from RBI and NPCI publications",
	"source_url": "https://github.com/razorpay/ifsc/releases",
	"license_name": "Public domain dataset",
	"license_url": "https://github.com/razorpay/ifsc#license",
	"attribution": "Source: Razorpay IFSC dataset, derived from RBI and NPCI publications. This is not a first-party RBI download.",
}


@dataclass(frozen=True)
class ImportMetadata:
	dataset_type: DatasetType
	source_name: str
	source_url: str
	license_name: str
	license_url: str
	attribution: str
	version: str
	source_updated_at: str


def import_pin_csv(path: str, version: str, source_updated_at: str) -> dict[str, object]:
	return import_csv(path, ImportMetadata(
		dataset_type="PIN",
		version=version,
		source_updated_at=source_updated_at,
		**PIN_SOURCE,
	))


def import_ifsc_csv(path: str, version: str, source_updated_at: str) -> dict[str, object]:
	return import_csv(path, ImportMetadata(
		dataset_type="IFSC",
		version=version,
		source_updated_at=source_updated_at,
		**IFSC_SOURCE,
	))


def import_csv(path: str, metadata: ImportMetadata) -> dict[str, object]:
	"""Stage, validate, and atomically activate one complete local dataset."""
	_validate_metadata(metadata)
	file_path = Path(path).resolve(strict=True)
	checksum = file_sha256(file_path)
	with frappe.db.advisory_lock(f"toolbox:{metadata.dataset_type.lower()}-dataset-import", timeout=30):
		return _import_csv_locked(file_path, checksum, metadata)


def _import_csv_locked(
	file_path: Path,
	checksum: str,
	metadata: ImportMetadata,
) -> dict[str, object]:
	release_key = f"{metadata.dataset_type.lower()}:{checksum}"
	existing = frappe.db.get_value(RELEASE_DOCTYPE, release_key, ["name", "status"], as_dict=True)
	if existing:
		# Idempotent by dataset type + checksum: an already-imported dataset is returned
		# as-is. A Superseded release is never reactivated here — re-running an old import
		# command must not demote a newer Active release. Only an incomplete prior attempt
		# (Staged/Failed) is cleared and retried.
		if existing.status in ("Active", "Superseded"):
			return _release_payload(existing.name)
		_delete_release_rows(existing.name, metadata.dataset_type)
		frappe.delete_doc(RELEASE_DOCTYPE, existing.name, ignore_permissions=True)

	release = _create_release(release_key, checksum, metadata)
	try:
		with file_path.open(encoding="utf-8-sig", newline="") as source:
			result = stage_rows(metadata.dataset_type, csv.DictReader(source), release.name)
		if not result["record_count"]:
			raise ValueError("The dataset contains no valid records.")
		_activate_release(release.name, metadata.dataset_type, result)
	except Exception as error:
		_delete_release_rows(release.name, metadata.dataset_type)
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


def stage_rows(
	dataset_type: DatasetType,
	rows: Iterable[Mapping[str, object]],
	release_name: str,
) -> dict[str, int]:
	normalizer = normalize_pin_row if dataset_type == "PIN" else normalize_ifsc_row
	doctype = PIN_DOCTYPE if dataset_type == "PIN" else IFSC_DOCTYPE
	seen = set()
	batch = []
	record_count = 0
	exclusion_count = 0
	duplicate_count = 0

	for row in rows:
		normalized = normalizer(row)
		if normalized is None:
			# Row lacks a required field or is malformed (spec §8.8 "exclusion").
			exclusion_count += 1
			continue
		business_key = normalized["business_key"]
		if business_key in seen:
			# Same record appears earlier in this file — counted apart from exclusions.
			duplicate_count += 1
			continue
		seen.add(business_key)
		record_key = f"{release_name}:{business_key}"
		batch.append({
			"name": hashlib.sha256(record_key.encode()).hexdigest()[:40],
			"dataset_release": release_name,
			"record_key": record_key,
			**{key: value for key, value in normalized.items() if key != "business_key"},
		})
		if len(batch) == BATCH_SIZE:
			_bulk_insert(doctype, batch)
			record_count += len(batch)
			batch = []

	if batch:
		_bulk_insert(doctype, batch)
		record_count += len(batch)
	return {
		"record_count": record_count,
		"exclusion_count": exclusion_count,
		"duplicate_count": duplicate_count,
	}


def normalize_pin_row(row: Mapping[str, object]) -> dict[str, str] | None:
	values = _normalized_keys(row)
	pin_code = _text(values.get("pincode"))
	office_name = _text(values.get("officename"))
	district = _text(values.get("district"))
	state = _text(values.get("statename") or values.get("state"))
	if not pin_code.isdigit() or len(pin_code) != 6 or not all((office_name, district, state)):
		return None

	return {
		"business_key": "|".join((pin_code, office_name.casefold(), district.casefold(), state.casefold())),
		"pin_code": pin_code,
		"office_name": office_name,
		"office_type": _text(values.get("officetype")),
		"delivery_status": _text(values.get("delivery")),
		"district": district,
		"state": state,
		"division": _text(values.get("divisionname")),
		"region": _text(values.get("regionname")),
		"circle": _text(values.get("circlename")),
	}


def normalize_ifsc_row(row: Mapping[str, object]) -> dict[str, str] | None:
	values = _normalized_keys(row)
	ifsc_code = _text(values.get("ifsc")).upper()
	bank_name = _text(values.get("bank"))
	branch = _text(values.get("branch"))
	city = _text(values.get("city") or values.get("centre"))
	state = _text(values.get("state"))
	if not _valid_ifsc(ifsc_code) or not all((bank_name, branch, city, state)):
		return None

	return {
		"business_key": ifsc_code,
		"ifsc_code": ifsc_code,
		"bank_name": bank_name,
		"branch": branch,
		"address": _text(values.get("address")),
		"city": city,
		"district": _text(values.get("district")),
		"state": state,
	}


def file_sha256(path: Path) -> str:
	digest = hashlib.sha256()
	with path.open("rb") as source:
		for chunk in iter(lambda: source.read(1024 * 1024), b""):
			digest.update(chunk)
	return digest.hexdigest()


def _create_release(release_key: str, checksum: str, metadata: ImportMetadata):
	return frappe.get_doc({
		"doctype": RELEASE_DOCTYPE,
		"release_key": release_key,
		"dataset_type": metadata.dataset_type,
		"status": "Staged",
		"source_name": metadata.source_name,
		"source_url": metadata.source_url,
		"license_name": metadata.license_name,
		"license_url": metadata.license_url,
		"attribution": metadata.attribution,
		"version": metadata.version,
		"source_updated_at": metadata.source_updated_at,
		"checksum": checksum,
	}).insert(ignore_permissions=True)


def _activate_release(release_name: str, dataset_type: DatasetType, result: dict[str, int]) -> None:
	frappe.db.get_value(RELEASE_DOCTYPE, release_name, "name", for_update=True)
	previous_active = frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"dataset_type": dataset_type, "status": "Active"},
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
	_prune_superseded_rows(dataset_type, keep=set(previous_active))


def _prune_superseded_rows(dataset_type: DatasetType, keep: set[str]) -> None:
	doctype = PIN_DOCTYPE if dataset_type == "PIN" else IFSC_DOCTYPE
	superseded = frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"dataset_type": dataset_type, "status": "Superseded"},
		pluck="name",
	)
	for name in superseded:
		if name not in keep:
			# Release metadata row stays for history; only its bulky record rows go.
			frappe.db.delete(doctype, {"dataset_release": name})


def _bulk_insert(doctype: str, rows: list[dict[str, str]]) -> None:
	fields = list(rows[0])
	frappe.db.bulk_insert(doctype, fields, ([row[field] for field in fields] for row in rows))


def _delete_release_rows(release_name: str, dataset_type: DatasetType) -> None:
	doctype = PIN_DOCTYPE if dataset_type == "PIN" else IFSC_DOCTYPE
	frappe.db.delete(doctype, {"dataset_release": release_name})


def _release_payload(name: str) -> dict[str, object]:
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		name,
		["name", "dataset_type", "status", "version", "source_updated_at", "imported_at", "checksum", "record_count", "exclusion_count", "duplicate_count"],
		as_dict=True,
	)


def _validate_metadata(metadata: ImportMetadata) -> None:
	if metadata.dataset_type not in {"PIN", "IFSC"}:
		raise ValueError("Unsupported dataset type.")
	for field_name, value in vars(metadata).items():
		if field_name != "dataset_type" and not _text(value):
			raise ValueError(f"Missing dataset metadata: {field_name}.")


def _normalized_keys(row: Mapping[str, object]) -> dict[str, object]:
	return {str(key).casefold().replace("_", "").replace(" ", ""): value for key, value in row.items()}


def _text(value: object) -> str:
	return " ".join(str(value or "").strip().split())


def _valid_ifsc(value: str) -> bool:
	return len(value) == 11 and value[:4].isalpha() and value[4] == "0" and value[5:].isalnum()
