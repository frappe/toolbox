# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Guest-facing HSN/SAC lookup over the bundled dataset.

Standalone: reads Toolbox's own imported HSN/SAC release, so no ERPNext or India
Compliance install is needed. Bounded and read-only, like the PIN/IFSC lookups.
"""

from __future__ import annotations

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit

from toolbox.hsn_data import HSN_DOCTYPE
from toolbox.india_business_data import RELEASE_DOCTYPE

MAX_RESULTS = 25


@frappe.whitelist(methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def get_dataset_status() -> dict[str, object]:
	return {"schemaVersion": 1, "hsn": _active_metadata()}


@frappe.whitelist(methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def search_hsn(query: str, limit: int = 20) -> dict[str, object]:
	term = _search_term(query)
	release = _active_release()
	if not release:
		return {"schemaVersion": 1, "state": "unavailable", "results": []}

	record = frappe.qb.DocType(HSN_DOCTYPE)
	builder = (
		frappe.qb.from_(record)
		.select(record.code, record.code_type, record.description)
		.where(record.dataset_release == release.name)
	)
	if term.isdigit():
		builder = builder.where(record.code.like(_like_prefix(term)))
	else:
		contains = _like_contains(term)
		builder = builder.where(record.description.like(contains) | record.code.like(contains))
	rows = builder.orderby(record.code).limit(_limit(limit)).run(as_dict=True)
	return {"schemaVersion": 1, "state": "ready", "version": release.version, "results": rows}


def _active_metadata() -> dict[str, object] | None:
	release = _active_release()
	if not release:
		return None
	return {
		"version": release.version,
		"sourceUpdatedAt": release.source_updated_at,
		"importedAt": release.imported_at,
		"recordCount": release.record_count,
		"source": {
			"name": release.source_name,
			"url": release.source_url,
			"license": release.license_name,
			"licenseUrl": release.license_url,
			"attribution": release.attribution,
		},
	}


def _active_release():
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		{"dataset_type": "HSN", "status": "Active"},
		["name", "version", "source_updated_at", "imported_at", "record_count", "source_name", "source_url", "license_name", "license_url", "attribution"],
		as_dict=True,
	)


def _search_term(query: str) -> str:
	term = " ".join(str(query or "").strip().split())
	if len(term) < 2 or len(term) > 80:
		frappe.throw(_("Enter between 2 and 80 characters."))
	return term


def _limit(value: int) -> int:
	return max(1, min(int(value), MAX_RESULTS))


def _escape(value: str) -> str:
	return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_prefix(value: str) -> str:
	return f"{_escape(value)}%"


def _like_contains(value: str) -> str:
	return f"%{_escape(value)}%"
