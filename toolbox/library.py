# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for the Library (Saved Links) module.

Saved links are private personal records. Every method runs as the logged-in user and only
ever touches records that user owns. Reads filter by ``owner``; writes go through the DocType
(``if_owner`` permissions apply) after an explicit ownership check.

URL handling is deterministic and offline: ``normalise_url`` validates and canonicalises a URL
so duplicates collapse and only ``http``/``https`` links are ever stored. Nothing here fetches
a URL or contacts an external host; metadata is entered by the user.
"""

import re
from urllib.parse import urlsplit, urlunsplit

import frappe
from frappe import _

DOCTYPE = "Toolbox Saved Link"
COLLECTION_DOCTYPE = "Toolbox Link Collection"

STATUSES = ("Inbox", "Read Later", "Read", "Archived")

MAX_URL = 2000
MAX_TITLE = 300
MAX_SITE_NAME = 200
MAX_TEXT = 2000

ALLOWED_SCHEMES = frozenset({"http", "https"})
DEFAULT_PORTS = {"http": 80, "https": 443}
_SCHEME_RE = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.\-]*):")


# ---------------------------------------------------------------------------
# URL utilities (pure, deterministic, offline)
# ---------------------------------------------------------------------------
def normalise_url(url: str) -> str:
	"""Validate and canonicalise ``url`` for storage and duplicate detection.

	Only ``http`` and ``https`` are allowed; ``javascript:``, ``data:``, ``file:`` and other
	schemes, as well as embedded credentials, are rejected. The host is lowercased, default
	ports (80/443) and the fragment are stripped, a trailing slash is removed conservatively,
	and query parameters are kept because they can identify distinct resources.
	"""
	raw = (url or "").strip()
	if not raw:
		frappe.throw(_("Enter a URL to save."))
	if len(raw) > MAX_URL:
		frappe.throw(_("That URL is too long to save."))

	candidate = _apply_scheme(raw)
	parts = urlsplit(candidate)

	scheme = (parts.scheme or "").lower()
	if scheme not in ALLOWED_SCHEMES:
		frappe.throw(_("Only http and https links can be saved."))
	if "@" in parts.netloc:
		frappe.throw(_("Links with embedded credentials are not allowed."))

	host = (parts.hostname or "").lower()
	if not host:
		frappe.throw(_("That URL is missing a host name."))

	try:
		port = parts.port
	except ValueError:
		frappe.throw(_("That URL has an invalid port."))

	netloc = host
	if port is not None and port != DEFAULT_PORTS.get(scheme):
		netloc = f"{host}:{port}"

	path = parts.path.rstrip("/")
	return urlunsplit((scheme, netloc, path, parts.query, ""))


def domain_of(url: str) -> str:
	"""Return the lowercase host of a (already normalised) URL, or an empty string."""
	return (urlsplit(url).hostname or "").lower()


def _apply_scheme(raw: str) -> str:
	"""Return ``raw`` with a scheme, or reject a non-http/https scheme.

	Bare hosts (``example.com/x``) and protocol-relative URLs (``//example.com/x``) become
	``https``. A dotted or numeric-port "scheme" such as ``example.com:8080`` is a host, not a
	real scheme. Any genuine foreign scheme (``javascript:``, ``data:``, ``file:``) is rejected.
	"""
	lower = raw.lower()
	if lower.startswith("http://") or lower.startswith("https://"):
		return raw

	match = _SCHEME_RE.match(raw)
	if match:
		scheme = match.group(1).lower()
		rest = raw[match.end() :]
		if scheme in ALLOWED_SCHEMES:
			# "http:example.com" without slashes — treat the remainder as the host.
			return f"{scheme}://{rest.lstrip('/')}"
		# A dotted host or a numeric port after the colon is a bare "host:port", not a scheme.
		if "." in scheme or rest[:1].isdigit():
			return f"https://{raw}"
		frappe.throw(_("Only http and https links can be saved."))

	# Schemeless: a bare host, or a protocol-relative "//host/path".
	return f"https://{raw.lstrip('/')}"


# ---------------------------------------------------------------------------
# Saved links
# ---------------------------------------------------------------------------
@frappe.whitelist()
@frappe.read_only()
def list_links(status: str = "", collection: str = "", tag: str = "", search: str = "") -> list[dict]:
	"""Return the current user's saved links, most recently modified first.

	Optional filters narrow by ``status``, ``collection`` and ``tag`` (server-side). ``search``
	matches the title, URL, description, personal note or tags.
	"""
	filters: dict = {"owner": frappe.session.user}
	if status and status in STATUSES:
		filters["status"] = status
	if collection:
		filters["collection"] = collection
	if tag:
		filters["tags"] = ["like", f"%{tag}%"]

	or_filters = None
	if search:
		like = f"%{search}%"
		or_filters = [
			["title", "like", like],
			["url", "like", like],
			["description", "like", like],
			["personal_note", "like", like],
			["tags", "like", like],
		]

	rows = frappe.get_all(
		DOCTYPE,
		filters=filters,
		or_filters=or_filters,
		fields=[
			"name",
			"url",
			"normalised_url",
			"title",
			"description",
			"site_name",
			"domain",
			"personal_note",
			"collection",
			"status",
			"is_favourite",
			"tags",
			"creation",
			"modified",
		],
		order_by="modified desc",
	)
	return [_row_summary(row) for row in rows]


@frappe.whitelist()
@frappe.read_only()
def get_link(name: str) -> dict:
	return _serialize(_owned(name))


@frappe.whitelist(methods=["POST"])
def save_link(payload: str) -> dict:
	"""Create or update a link. Detects duplicates against the owner's existing links.

	When a different link with the same ``normalised_url`` already exists and the payload does
	not set ``allow_duplicate``, nothing is saved and a ``duplicate_of`` hint is returned so the
	caller can open the existing link or choose to save anyway.
	"""
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid link payload."))

	name = data.get("name")
	url = (data.get("url") or "").strip()
	if not url:
		frappe.throw(_("Enter a URL to save."))

	normalised = normalise_url(url)
	duplicate = _find_duplicate(normalised, exclude=name)
	if duplicate and not data.get("allow_duplicate"):
		return {"saved": False, "duplicate_of": duplicate["name"], "duplicate": duplicate, "normalised_url": normalised}

	doc = _owned(name) if name else frappe.new_doc(DOCTYPE)
	_apply(doc, data)
	doc.save()

	result = _serialize(doc)
	result["saved"] = True
	result["duplicate_of"] = None
	return result


@frappe.whitelist(methods=["POST"])
def delete_link(name: str) -> None:
	_owned(name)
	frappe.delete_doc(DOCTYPE, name)


@frappe.whitelist(methods=["POST"])
def set_status(name: str, status: str) -> dict:
	if status not in STATUSES:
		frappe.throw(_("Unknown status."))
	doc = _owned(name)
	doc.status = status
	doc.save()
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def toggle_favourite(name: str) -> dict:
	doc = _owned(name)
	doc.is_favourite = 0 if doc.is_favourite else 1
	doc.save()
	return _serialize(doc)


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------
@frappe.whitelist()
@frappe.read_only()
def list_collections() -> list[dict]:
	"""Return the current user's collections with the number of links in each."""
	rows = frappe.get_all(
		COLLECTION_DOCTYPE,
		filters={"owner": frappe.session.user},
		fields=["name", "collection_name", "description", "is_archived", "creation", "modified"],
		order_by="collection_name asc",
	)
	for row in rows:
		row["is_archived"] = bool(row.get("is_archived"))
		row["link_count"] = frappe.db.count(
			DOCTYPE, {"owner": frappe.session.user, "collection": row["collection_name"]}
		)
		row["creation"] = str(row["creation"]) if row.get("creation") else None
		row["modified"] = str(row["modified"]) if row.get("modified") else None
	return rows


@frappe.whitelist(methods=["POST"])
def save_collection(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid collection payload."))

	collection_name = (data.get("collection_name") or "").strip()
	if not collection_name:
		frappe.throw(_("Enter a collection name."))

	name = data.get("name")
	doc = _owned_collection(name) if name else frappe.new_doc(COLLECTION_DOCTYPE)
	doc.collection_name = _truncate(collection_name, MAX_TITLE)
	doc.description = (data.get("description") or "").strip() or None
	doc.is_archived = 1 if data.get("is_archived") else 0
	doc.save()
	return _serialize_collection(doc)


@frappe.whitelist(methods=["POST"])
def delete_collection(name: str) -> None:
	_owned_collection(name)
	frappe.delete_doc(COLLECTION_DOCTYPE, name)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@frappe.whitelist()
@frappe.read_only()
def export_links() -> dict:
	"""Return every saved link as JSON records plus CSV-ready columns and rows.

	The response is data only; the frontend builds and triggers the file downloads.
	"""
	links = list_links()
	columns = ["url", "title", "description", "site_name", "domain", "personal_note", "collection", "status", "is_favourite", "tags"]
	rows = []
	for link in links:
		rows.append(
			[
				link.get("url") or "",
				link.get("title") or "",
				link.get("description") or "",
				link.get("site_name") or "",
				link.get("domain") or "",
				link.get("personal_note") or "",
				link.get("collection") or "",
				link.get("status") or "",
				"1" if link.get("is_favourite") else "0",
				", ".join(link.get("tags") or []),
			]
		)
	return {"links": links, "csv_columns": columns, "csv_rows": rows}


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _apply(doc, data: dict) -> None:
	doc.url = _truncate((data.get("url") or "").strip(), MAX_URL)
	doc.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or None
	doc.description = _truncate((data.get("description") or "").strip(), MAX_TEXT) or None
	doc.site_name = _truncate((data.get("site_name") or "").strip(), MAX_SITE_NAME) or None
	doc.personal_note = _truncate((data.get("personal_note") or "").strip(), MAX_TEXT) or None
	doc.collection = _truncate((data.get("collection") or "").strip(), MAX_TITLE) or None

	status = data.get("status")
	doc.status = status if status in STATUSES else (doc.status or "Inbox")
	doc.is_favourite = 1 if data.get("is_favourite") else 0
	doc.tags = _join_tags(data.get("tags"))
	# normalised_url and domain are (re)computed by the controller on validate.


def _find_duplicate(normalised: str, exclude: str | None = None) -> dict | None:
	filters: dict = {"owner": frappe.session.user, "normalised_url": normalised}
	if exclude:
		filters["name"] = ["!=", exclude]
	rows = frappe.get_all(
		DOCTYPE,
		filters=filters,
		fields=["name", "url", "title", "domain", "status"],
		order_by="modified desc",
		limit=1,
	)
	return rows[0] if rows else None


def _serialize(doc) -> dict:
	return {
		"name": doc.name,
		"url": doc.url,
		"normalised_url": doc.normalised_url,
		"title": doc.title,
		"description": doc.description,
		"site_name": doc.site_name,
		"domain": doc.domain,
		"personal_note": doc.personal_note,
		"collection": doc.collection,
		"status": doc.status,
		"is_favourite": bool(doc.is_favourite),
		"tags": _split_tags(doc.tags),
		"creation": str(doc.creation) if doc.creation else None,
		"modified": str(doc.modified) if doc.modified else None,
	}


def _serialize_collection(doc) -> dict:
	return {
		"name": doc.name,
		"collection_name": doc.collection_name,
		"description": doc.description,
		"is_archived": bool(doc.is_archived),
		"creation": str(doc.creation) if doc.creation else None,
		"modified": str(doc.modified) if doc.modified else None,
	}


def _row_summary(row: dict) -> dict:
	row["is_favourite"] = bool(row.get("is_favourite"))
	row["tags"] = _split_tags(row.get("tags"))
	row["creation"] = str(row["creation"]) if row.get("creation") else None
	row["modified"] = str(row["modified"]) if row.get("modified") else None
	return row


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Link not found."))
	doc = frappe.get_doc(DOCTYPE, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this link."))
	return doc


def _owned_collection(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Collection not found."))
	doc = frappe.get_doc(COLLECTION_DOCTYPE, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this collection."))
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
