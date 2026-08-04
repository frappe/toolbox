# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""API for checklist templates: browse system + personal templates, instantiate a checklist
from one, and save a checklist as a personal template."""

import frappe
from frappe import _

from toolbox.checklists import DOCTYPE as CHECKLIST_DOCTYPE
from toolbox.checklists import _serialize as serialize_checklist

TEMPLATE_DOCTYPE = "Toolbox Checklist Template"
MAX_NAME = 200


@frappe.whitelist()
@frappe.read_only()
def list_templates() -> list[dict]:
	"""System templates (available to everyone) plus the caller's own personal templates."""
	user = frappe.session.user
	rows = frappe.get_all(
		TEMPLATE_DOCTYPE,
		filters={"is_active": 1},
		or_filters={"scope": "System", "owner": user},
		fields=["name", "template_name", "description", "scope", "category", "owner"],
		order_by="scope asc, template_name asc",
	)
	for row in rows:
		row["item_count"] = frappe.db.count(
			"Toolbox Checklist Template Item", {"parent": row["name"]}
		)
		row["is_system"] = row.pop("scope") == "System"
		row["is_owner"] = row.pop("owner") == user
	return rows


@frappe.whitelist(methods=["POST"])
def create_checklist_from_template(template: str) -> dict:
	"""Create a new checklist owned by the caller, seeded from a readable template's items."""
	tpl = _readable_template(template)
	checklist = frappe.new_doc(CHECKLIST_DOCTYPE)
	checklist.title = _truncate(tpl.template_name, MAX_NAME)
	checklist.description = tpl.description
	checklist.source_template = tpl.template_name
	checklist.move_completed_to_bottom = 1
	for item in sorted(tpl.items, key=lambda row: row.sort_order):
		checklist.append("items", {"item_text": item.item_text})
	checklist.insert()
	return serialize_checklist(checklist)


@frappe.whitelist(methods=["POST"])
def save_as_template(checklist: str, template_name: str = "") -> dict:
	"""Save an existing checklist's items as a new personal template owned by the caller."""
	source = frappe.get_doc(CHECKLIST_DOCTYPE, checklist)
	if source.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to use this checklist."))

	name = _truncate((template_name or source.title or "").strip(), MAX_NAME)
	tpl = frappe.new_doc(TEMPLATE_DOCTYPE)
	tpl.template_name = name or _("Untitled template")
	tpl.description = source.description
	tpl.scope = "Personal"
	tpl.is_active = 1
	tpl.version = 1
	for index, item in enumerate(source.items):
		tpl.append("items", {"item_text": item.item_text, "sort_order": index})
	tpl.insert()
	return {"name": tpl.name, "template_name": tpl.template_name, "is_system": False}


@frappe.whitelist(methods=["POST"])
def delete_template(name: str) -> None:
	"""Delete a personal template. System templates cannot be deleted by users."""
	tpl = frappe.get_doc(TEMPLATE_DOCTYPE, name)
	if tpl.scope == "System":
		raise frappe.PermissionError(_("System templates cannot be deleted."))
	if tpl.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to delete this template."))
	frappe.delete_doc(TEMPLATE_DOCTYPE, name)


def _readable_template(identifier: str):
	"""Resolve a template by name (or template_name) and confirm the caller may read it."""
	if not identifier:
		raise frappe.DoesNotExistError(_("Template not found."))

	name = identifier
	if not frappe.db.exists(TEMPLATE_DOCTYPE, identifier):
		name = frappe.db.get_value(
			TEMPLATE_DOCTYPE,
			{"template_name": identifier, "scope": "System"},
			"name",
		)
	if not name:
		raise frappe.DoesNotExistError(_("Template not found."))

	tpl = frappe.get_doc(TEMPLATE_DOCTYPE, name)
	user = frappe.session.user
	readable = tpl.scope == "System" or tpl.owner == user or user == "Administrator"
	if not readable:
		raise frappe.PermissionError(_("You are not permitted to use this template."))
	return tpl


def _truncate(text: str, limit: int) -> str:
	return text if len(text) <= limit else text[:limit]
