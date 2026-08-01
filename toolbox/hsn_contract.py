# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

from typing import Protocol

import frappe

INDIA_COMPLIANCE_APP = "india_compliance"
ERP_NEXT_APP = "erpnext"
HSN_DOCTYPE = "GST HSN Code"
REQUIRED_FIELDS = {"hsn_code": {"Data"}, "description": {"Data", "Small Text", "Text"}}
OPTIONAL_FIELDS = {
	"gstRate": ("gst_rate", {"Currency", "Float", "Percent"}),
	"cess": ("cess_rate", {"Currency", "Float", "Percent"}),
	"effectiveDate": ("valid_from", {"Date"}),
	"statutorySource": ("statutory_source", {"Data", "Link", "Small Text", "Text"}),
}
MISSING_STATUTORY_FIELDS = tuple(OPTIONAL_FIELDS)
SOURCE_URL = (
	"https://github.com/resilient-tech/india-compliance/"
	"tree/develop/india_compliance/gst_india/doctype/gst_hsn_code"
)


class MetaField(Protocol):
	fieldtype: str


class DocTypeMeta(Protocol):
	def get_field(self, fieldname: str) -> MetaField | None: ...


def inspect_hsn_contract(meta: DocTypeMeta | None = None) -> dict[str, object]:
	"""Describe the narrow India Compliance contract used by Toolbox."""
	meta = meta or frappe.get_meta(HSN_DOCTYPE)
	missing_required: list[str] = []
	available_fields: list[str] = []
	statutory_fields: dict[str, str] = {}

	for fieldname, allowed_types in REQUIRED_FIELDS.items():
		field = meta.get_field(fieldname)
		if field and field.fieldtype in allowed_types:
			available_fields.append(fieldname)
		else:
			missing_required.append(fieldname)

	taxes = meta.get_field("taxes")
	if taxes and taxes.fieldtype == "Table":
		available_fields.append("taxes")
	for public_name, (fieldname, allowed_types) in OPTIONAL_FIELDS.items():
		field = meta.get_field(fieldname)
		if field and field.fieldtype in allowed_types:
			statutory_fields[public_name] = fieldname

	return {
		"compatible": not missing_required,
		"doctype": HSN_DOCTYPE,
		"availableFields": available_fields,
		"missingRequiredFields": missing_required,
		"statutoryFields": statutory_fields,
		"missingStatutoryFields": [
			fieldname for fieldname in MISSING_STATUTORY_FIELDS if fieldname not in statutory_fields
		],
		"taxFieldNature": (
			"The taxes table stores site-configured Item Tax Template links. "
			"It is not an authoritative statutory GST-rate source."
		),
		"source": {
			"name": "India Compliance GST HSN Code",
			"url": SOURCE_URL,
		},
	}
