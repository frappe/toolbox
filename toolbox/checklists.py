# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for the Checklists module.

Checklists are private personal records. Every method runs as the logged-in user and only
ever touches records that user owns. Reads filter by ``owner``; writes go through the
DocType (``if_owner`` permissions apply) after an explicit ownership check.
"""

import frappe
from frappe import _
from frappe.utils import cint

DOCTYPE = "Toolbox Checklist"
ITEM_DOCTYPE = "Toolbox Checklist Item"
MAX_TITLE = 200
MAX_ITEMS = 500
MAX_ITEM_TEXT = 500


@frappe.whitelist()
@frappe.read_only()
def list_checklists(include_archived: int = 0) -> list[dict]:
	"""Return the current user's checklists with item counts, pinned first."""
	filters = {"owner": frappe.session.user}
	if not cint(include_archived):
		filters["is_archived"] = 0
	rows = frappe.get_all(
		DOCTYPE,
		filters=filters,
		fields=[
			"name",
			"title",
			"description",
			"due_date",
			"is_pinned",
			"is_archived",
			"tags",
			"modified",
		],
		order_by="is_pinned desc, modified desc",
	)
	for row in rows:
		row["total_items"] = frappe.db.count(ITEM_DOCTYPE, {"parent": row["name"]})
		row["completed_items"] = frappe.db.count(
			ITEM_DOCTYPE, {"parent": row["name"], "is_completed": 1}
		)
		row["tags"] = _split_tags(row.get("tags"))
		row["due_date"] = str(row["due_date"]) if row.get("due_date") else None
		row["modified"] = str(row["modified"]) if row.get("modified") else None
	return rows


@frappe.whitelist()
@frappe.read_only()
def get_checklist(name: str) -> dict:
	return _serialize(_owned(name))


@frappe.whitelist(methods=["POST"])
def save_checklist(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid checklist payload."))

	name = data.get("name")
	doc = _owned(name) if name else frappe.new_doc(DOCTYPE)
	_apply(doc, data)
	doc.save()
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def delete_checklist(name: str) -> None:
	_owned(name)
	frappe.delete_doc(DOCTYPE, name)


@frappe.whitelist(methods=["POST"])
def duplicate_checklist(name: str) -> dict:
	"""Copy a checklist as a fresh, incomplete, unpinned list owned by the caller."""
	source = _owned(name)
	copy = frappe.copy_doc(source)
	copy.title = _truncate(_("{0} (copy)").format(source.title), MAX_TITLE)
	copy.is_pinned = 0
	copy.is_archived = 0
	copy.source_template = None
	for item in copy.items:
		item.is_completed = 0
		item.completed_at = None
	copy.insert()
	return _serialize(copy)


def _apply(doc, data: dict) -> None:
	doc.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or _("Untitled checklist")
	doc.description = (data.get("description") or "").strip() or None
	doc.due_date = data.get("due_date") or None
	doc.is_pinned = 1 if data.get("is_pinned") else 0
	doc.is_archived = 1 if data.get("is_archived") else 0
	doc.move_completed_to_bottom = 0 if data.get("move_completed_to_bottom") is False else 1
	doc.tags = _join_tags(data.get("tags"))

	items = data.get("items") or []
	if len(items) > MAX_ITEMS:
		frappe.throw(_("A checklist cannot have more than {0} items.").format(MAX_ITEMS))

	doc.set("items", [])
	for raw in items:
		text = (raw.get("item_text") or "").strip()
		if not text:
			continue
		doc.append(
			"items",
			{
				"item_text": _truncate(text, MAX_ITEM_TEXT),
				"is_completed": 1 if raw.get("is_completed") else 0,
				"note": (raw.get("note") or "").strip() or None,
			},
		)


def _serialize(doc) -> dict:
	return {
		"name": doc.name,
		"title": doc.title,
		"description": doc.description,
		"due_date": str(doc.due_date) if doc.due_date else None,
		"is_pinned": bool(doc.is_pinned),
		"is_archived": bool(doc.is_archived),
		"move_completed_to_bottom": bool(doc.move_completed_to_bottom),
		"source_template": doc.source_template,
		"tags": _split_tags(doc.tags),
		"items": [
			{
				"item_text": item.item_text,
				"is_completed": bool(item.is_completed),
				"completed_at": str(item.completed_at) if item.completed_at else None,
				"sort_order": item.sort_order,
				"note": item.note,
			}
			for item in doc.items
		],
		"creation": str(doc.creation),
		"modified": str(doc.modified),
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Checklist not found."))
	doc = frappe.get_doc(DOCTYPE, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this checklist."))
	return doc


def _split_tags(value) -> list[str]:
	if not value:
		return []
	return [tag.strip() for tag in value.split(",") if tag.strip()]


def _join_tags(value) -> str | None:
	if not value:
		return None
	tags = _split_tags(value) if isinstance(value, str) else [str(tag).strip() for tag in value]
	seen: set[str] = set()
	unique: list[str] = []
	for tag in tags:
		if not tag:
			continue
		key = tag.lower()
		if key in seen:
			continue
		seen.add(key)
		unique.append(tag)
	return ", ".join(unique) or None


def _truncate(text: str, limit: int) -> str:
	return text if len(text) <= limit else text[:limit]
