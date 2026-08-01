import frappe
from frappe import _
from frappe.rate_limiter import rate_limit

from toolbox.india_business_data import IFSC_DOCTYPE, PIN_DOCTYPE, RELEASE_DOCTYPE

MAX_RESULTS = 20


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def get_dataset_status() -> dict[str, object]:
	return {
		"schemaVersion": 1,
		"pin": _active_metadata("PIN"),
		"ifsc": _active_metadata("IFSC"),
	}


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def search_pin(query: str, limit: int = 10) -> dict[str, object]:
	term = _search_term(query)
	release = _active_release("PIN")
	if not release:
		return _unavailable("PIN")

	record = frappe.qb.DocType(PIN_DOCTYPE)
	fields = (record.pin_code, record.office_name, record.office_type, record.delivery_status, record.district, record.state)
	count = _limit(limit)
	if term.isdigit() and len(term) == 6:
		rows = _indexed_query(record, fields, release.name, record.pin_code == term, record.office_name, count)
	else:
		rows = _prefix_search(
			record, fields, release.name, _like_prefix(term), count,
			columns=(record.pin_code, record.office_name, record.district, record.state),
			identity=lambda row: (row["pin_code"], row["office_name"], row["district"], row["state"]),
		)
	return _search_payload(release, rows)


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def search_ifsc(query: str, limit: int = 10) -> dict[str, object]:
	term = _search_term(query).upper()
	release = _active_release("IFSC")
	if not release:
		return _unavailable("IFSC")

	record = frappe.qb.DocType(IFSC_DOCTYPE)
	fields = (record.ifsc_code, record.bank_name, record.branch, record.address, record.city, record.district, record.state)
	count = _limit(limit)
	if len(term) == 11:
		rows = _indexed_query(record, fields, release.name, record.ifsc_code == term, record.ifsc_code, count)
	else:
		rows = _prefix_search(
			record, fields, release.name, _like_prefix(term), count,
			columns=(record.ifsc_code, record.bank_name, record.branch, record.city, record.state),
			identity=lambda row: row["ifsc_code"],
		)
	return _search_payload(release, rows)


def _indexed_query(record, fields, release_name, condition, order_field, limit):
	return (
		frappe.qb.from_(record)
		.select(*fields)
		.where((record.dataset_release == release_name) & condition)
		.orderby(order_field)
		.limit(limit)
	).run(as_dict=True)


def _prefix_search(record, fields, release_name, prefix, limit, columns, identity):
	"""Search each column with its own indexed prefix query, then merge by column
	priority and de-duplicate. Each sub-query uses the (dataset_release, column)
	composite index for both filter and order, so LIMIT stops early — avoiding the
	full-release scan and filesort that a single OR-across-columns query triggers when
	a term matches many rows. Earlier columns rank higher (code/pincode before names)."""
	seen: set = set()
	merged: list = []
	for column in columns:
		for row in _indexed_query(record, fields, release_name, column.like(prefix), column, limit):
			key = identity(row)
			if key not in seen:
				seen.add(key)
				merged.append(row)
		if len(merged) >= limit:
			break
	return merged[:limit]


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
