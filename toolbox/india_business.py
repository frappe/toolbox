import frappe
from frappe import _

from toolbox.india_business_data import IFSC_DOCTYPE, PIN_DOCTYPE, RELEASE_DOCTYPE

MAX_RESULTS = 20


@frappe.whitelist(allow_guest=True, methods=["GET"])
@frappe.read_only()
def get_dataset_status() -> dict[str, object]:
	return {
		"schemaVersion": 1,
		"pin": _active_metadata("PIN"),
		"ifsc": _active_metadata("IFSC"),
	}


@frappe.whitelist(allow_guest=True, methods=["GET"])
@frappe.read_only()
def search_pin(query: str, limit: int = 10) -> dict[str, object]:
	term = _search_term(query)
	release = _active_release("PIN")
	if not release:
		return _unavailable("PIN")

	record = frappe.qb.DocType(PIN_DOCTYPE)
	prefix = _like_prefix(term)
	condition = record.pin_code == term if term.isdigit() and len(term) == 6 else (
		record.pin_code.like(prefix)
		| record.office_name.like(prefix)
		| record.district.like(prefix)
		| record.state.like(prefix)
	)
	rows = (
		frappe.qb.from_(record)
		.select(record.pin_code, record.office_name, record.office_type, record.delivery_status, record.district, record.state)
		.where((record.dataset_release == release.name) & condition)
		.orderby(record.pin_code, record.office_name)
		.limit(_limit(limit))
	).run(as_dict=True)
	return _search_payload(release, rows)


@frappe.whitelist(allow_guest=True, methods=["GET"])
@frappe.read_only()
def search_ifsc(query: str, limit: int = 10) -> dict[str, object]:
	term = _search_term(query).upper()
	release = _active_release("IFSC")
	if not release:
		return _unavailable("IFSC")

	record = frappe.qb.DocType(IFSC_DOCTYPE)
	prefix = _like_prefix(term)
	condition = record.ifsc_code == term if len(term) == 11 else (
		record.ifsc_code.like(prefix)
		| record.bank_name.like(prefix)
		| record.branch.like(prefix)
		| record.city.like(prefix)
		| record.state.like(prefix)
	)
	rows = (
		frappe.qb.from_(record)
		.select(record.ifsc_code, record.bank_name, record.branch, record.address, record.city, record.district, record.state)
		.where((record.dataset_release == release.name) & condition)
		.orderby(record.ifsc_code)
		.limit(_limit(limit))
	).run(as_dict=True)
	return _search_payload(release, rows)


def _active_metadata(dataset_type: str) -> dict[str, object] | None:
	release = _active_release(dataset_type)
	if not release:
		return None
	return {
		"version": release.version,
		"sourceUpdatedAt": release.source_updated_at,
		"importedAt": release.imported_at,
		"recordCount": release.record_count,
		"exclusionCount": release.exclusion_count,
		"source": {"name": release.source_name, "url": release.source_url, "license": release.license_name, "licenseUrl": release.license_url, "attribution": release.attribution},
	}


def _active_release(dataset_type: str):
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		{"dataset_type": dataset_type, "status": "Active"},
		["name", "version", "source_updated_at", "imported_at", "record_count", "exclusion_count", "source_name", "source_url", "license_name", "license_url", "attribution"],
		as_dict=True,
	)


def _search_term(query: str) -> str:
	term = " ".join(str(query or "").strip().split())
	if len(term) < 2 or len(term) > 80:
		frappe.throw(_("Enter between 2 and 80 characters."))
	return term


def _limit(value: int) -> int:
	return max(1, min(int(value), MAX_RESULTS))


def _like_prefix(value: str) -> str:
	escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
	return f"{escaped}%"


def _unavailable(dataset_type: str) -> dict[str, object]:
	return {"schemaVersion": 1, "state": "unavailable", "datasetType": dataset_type, "results": []}


def _search_payload(release, rows: list[dict[str, object]]) -> dict[str, object]:
	return {"schemaVersion": 1, "state": "ready", "version": release.version, "results": rows}
