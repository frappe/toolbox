# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

import hashlib
import importlib
import re
from datetime import datetime
from typing import Protocol

import frappe
from frappe import _
from frappe.query_builder.functions import Count, Max

from toolbox.hsn_contract import HSN_DOCTYPE, OPTIONAL_FIELDS, SOURCE_URL, inspect_hsn_contract

MAX_RECORDS = 25_000
CODE_PATTERN = re.compile(r"^[0-9]{2,12}$")
REVISION_PATTERN = re.compile(r"^[a-f0-9]{64}$")


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_hsn_catalog(known_revision: str | None = None) -> dict[str, object]:
	"""Return public HSN codes and descriptions from the installed site master."""
	return HsnCatalogService(FrappeHsnRepository()).get(known_revision)


class HsnRepository(Protocol):
	def contract(self) -> dict[str, object]: ...

	def metadata(self) -> dict[str, object]: ...

	def records(self) -> list[dict[str, object]]: ...


class HsnCatalogService:
	def __init__(self, repository: HsnRepository) -> None:
		self.repository = repository

	def get(self, known_revision: str | None = None) -> dict[str, object]:
		known_revision = _validate_revision(known_revision)
		contract = self.repository.contract()
		if not contract.get("compatible"):
			frappe.throw(_("The installed India Compliance HSN schema is not supported."), frappe.ValidationError)

		metadata = self.repository.metadata()
		if known_revision and known_revision == metadata["revision"]:
			return {**metadata, "schemaVersion": 1, "notModified": True}

		records = [_normalize_record(row) for row in self.repository.records()]
		if len(records) > MAX_RECORDS:
			frappe.throw(_("The India Compliance HSN master exceeds the supported size."), frappe.ValidationError)
		if len(records) != metadata["recordCount"]:
			frappe.throw(
				_("The India Compliance HSN master changed while the snapshot was loading. Please retry."),
				frappe.ValidationError,
			)

		return {
			**metadata,
			"schemaVersion": 1,
			"notModified": False,
			"records": records,
			"contract": contract,
			"source": {
				"name": "India Compliance GST HSN Code",
				"url": SOURCE_URL,
			},
		}


class FrappeHsnRepository:
	def contract(self) -> dict[str, object]:
		return inspect_hsn_contract()

	def metadata(self) -> dict[str, object]:
		hsn = frappe.qb.DocType(HSN_DOCTYPE)
		row = (
			frappe.qb.from_(hsn)
			.select(Count(hsn.name).as_("record_count"), Max(hsn.modified).as_("source_modified_at"))
		).run(as_dict=True)[0]
		record_count = int(row.record_count or 0)
		modified = _isoformat(row.source_modified_at)
		version = _india_compliance_version()
		return _metadata_from_values(record_count, modified, version)

	def records(self) -> list[dict[str, object]]:
		# India Compliance grants read access to this public classification master.
		# Toolbox deliberately exposes only contract-approved public fields.
		contract = self.contract()
		statutory_fields = contract.get("statutoryFields") or {}
		fields = ["hsn_code", "description", *statutory_fields.values()]
		return frappe.get_all(
			HSN_DOCTYPE,
			fields=fields,
			order_by="hsn_code asc",
			limit_page_length=MAX_RECORDS + 1,
		)


def _normalize_record(row: dict[str, object]) -> dict[str, object]:
	code = str(row.get("hsn_code") or "").strip()
	description = " ".join(str(row.get("description") or "").split())
	if not CODE_PATTERN.fullmatch(code):
		frappe.throw(_("The India Compliance master contains an invalid HSN/SAC code."), frappe.ValidationError)
	if not description or len(description) > 2_000:
		frappe.throw(_("The India Compliance master contains an invalid description."), frappe.ValidationError)
	record: dict[str, object] = {"code": code, "description": description}
	for public_name, (fieldname, _allowed_types) in OPTIONAL_FIELDS.items():
		value = row.get(fieldname)
		if value not in (None, ""):
			record[public_name] = _normalize_optional_value(public_name, value)
	return record


def _metadata_from_values(count: int, modified: str, version: str) -> dict[str, object]:
	value = f"{version}|{count}|{modified}".encode()
	return {
		"revision": hashlib.sha256(value).hexdigest(),
		"sourceVersion": version,
		"sourceModifiedAt": modified,
		"recordCount": count,
	}


def _validate_revision(value: str | None) -> str | None:
	if value is None or value == "":
		return None
	if not isinstance(value, str) or not REVISION_PATTERN.fullmatch(value):
		frappe.throw(_("The HSN snapshot revision is invalid."), frappe.ValidationError)
	return value


def _isoformat(value: object) -> str:
	if isinstance(value, datetime):
		return value.isoformat()
	return str(value or "")


def _normalize_optional_value(fieldname: str, value: object) -> object:
	if fieldname in {"gstRate", "cess"}:
		try:
			rate = float(value)
		except (TypeError, ValueError):
			frappe.throw(_("The India Compliance master contains an invalid tax rate."), frappe.ValidationError)
		if not 0 <= rate <= 100:
			frappe.throw(_("The India Compliance master contains an invalid tax rate."), frappe.ValidationError)
		return rate
	if fieldname == "effectiveDate":
		return _isoformat(value)
	return str(value)[:500]


def _india_compliance_version() -> str:
	try:
		module = importlib.import_module("india_compliance")
		return str(getattr(module, "__version__", "unknown"))
	except ImportError:
		return "unknown"
