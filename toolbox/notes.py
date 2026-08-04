# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for the Notes module.

Notes are private personal records. Every method runs as the logged-in user and only ever
touches records that user owns. Reads filter by ``owner``; writes go through the DocType
(``if_owner`` permissions apply) after an explicit ownership check. Content HTML is sanitized
on the server on every save, so stored notes can never carry scripts or event handlers even
if a client sends unclean markup.
"""

import frappe
from frappe import _
from frappe.utils import cint, sanitize_html

DOCTYPE = "Toolbox Note"
MAX_TITLE = 200
EXCERPT_LEN = 160


@frappe.whitelist()
@frappe.read_only()
def list_notes(include_archived: int = 0) -> list[dict]:
	"""Return the current user's notes as summary rows, pinned first then most recent."""
	filters = {"owner": frappe.session.user}
	if not cint(include_archived):
		filters["is_archived"] = 0
	rows = frappe.get_all(
		DOCTYPE,
		filters=filters,
		fields=[
			"name",
			"title",
			"search_text",
			"is_pinned",
			"is_archived",
			"tags",
			"modified",
		],
		order_by="is_pinned desc, modified desc",
	)
	for row in rows:
		row["excerpt"] = _excerpt(row.pop("search_text", None))
		row["is_pinned"] = bool(row.get("is_pinned"))
		row["is_archived"] = bool(row.get("is_archived"))
		row["tags"] = _split_tags(row.get("tags"))
		row["modified"] = str(row["modified"]) if row.get("modified") else None
	return rows


@frappe.whitelist()
@frappe.read_only()
def get_note(name: str) -> dict:
	return _serialize(_owned(name))


@frappe.whitelist(methods=["POST"])
def save_note(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid note payload."))

	name = data.get("name")
	doc = _owned(name) if name else frappe.new_doc(DOCTYPE)
	_apply(doc, data)
	doc.save()
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def delete_note(name: str) -> None:
	_owned(name)
	frappe.delete_doc(DOCTYPE, name)


@frappe.whitelist(methods=["POST"])
def duplicate_note(name: str) -> dict:
	"""Copy a note as a fresh, unpinned, unarchived note owned by the caller."""
	source = _owned(name)
	copy = frappe.copy_doc(source)
	copy.title = _truncate(_("{0} (copy)").format(source.title), MAX_TITLE)
	copy.is_pinned = 0
	copy.is_archived = 0
	copy.insert()
	return _serialize(copy)


def _apply(doc, data: dict) -> None:
	doc.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or _("Untitled note")
	# Sanitize here as well as in the controller: never trust client-side cleaning.
	doc.content_html = sanitize_html(data.get("content_html") or "", always_sanitize=True)
	doc.content_json = (data.get("content_json") or "").strip() or None
	doc.is_pinned = 1 if data.get("is_pinned") else 0
	doc.is_archived = 1 if data.get("is_archived") else 0
	doc.tags = _join_tags(data.get("tags"))


def _serialize(doc) -> dict:
	return {
		"name": doc.name,
		"title": doc.title,
		"content_html": doc.content_html or "",
		"content_json": doc.content_json,
		"search_text": doc.search_text or "",
		"is_pinned": bool(doc.is_pinned),
		"is_archived": bool(doc.is_archived),
		"tags": _split_tags(doc.tags),
		"creation": str(doc.creation),
		"modified": str(doc.modified),
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Note not found."))
	doc = frappe.get_doc(DOCTYPE, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this note."))
	return doc


def _excerpt(text) -> str:
	text = (text or "").strip()
	if len(text) <= EXCERPT_LEN:
		return text
	return text[:EXCERPT_LEN].rstrip() + "…"


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
