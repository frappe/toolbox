# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for the Audio library (Recorder slice).

Audio is saved as a private Frappe File attached to a per-owner ``Toolbox Audio Asset``. The
uploaded bytes are validated by their magic bytes (spec §14.3) — never by the client's claimed
MIME type or file name — and size-capped, before anything is written. Everything runs as the
logged-in user and only ever touches that user's own records.
"""

import base64
import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt
from frappe.utils.file_manager import save_file

ASSET = "Toolbox Audio Asset"

MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20 MB — voice-note scale; the Recorder is not for long tracks.
MAX_TITLE = 200
MAX_TEXT = 2000

# The tools that can save an asset and how each is recorded. Anything else falls back to the
# Recorder defaults so a crafted payload can never set an unknown source.
_SOURCE_TYPES = ("Recording", "Import", "Edited")
_CREATED_TOOLS = ("recorder", "editor")

# Detected container -> (canonical mime, file extension). The allowlist is exactly these.
_FORMATS = {
	"wav": ("audio/wav", "wav"),
	"ogg": ("audio/ogg", "ogg"),
	"webm": ("audio/webm", "webm"),
	"mp4": ("audio/mp4", "m4a"),
	"mp3": ("audio/mpeg", "mp3"),
	"flac": ("audio/flac", "flac"),
	"aac": ("audio/aac", "aac"),
}


def detect_audio_format(head: bytes) -> str | None:
	"""Return a container id from the file's leading bytes, or ``None`` if it is not audio."""
	if len(head) < 12:
		return None
	if head[0:4] == b"RIFF" and head[8:12] == b"WAVE":
		return "wav"
	if head[0:4] == b"OggS":
		return "ogg"
	if head[0:4] == b"fLaC":
		return "flac"
	if head[0:4] == b"\x1a\x45\xdf\xa3":  # EBML header — WebM / Matroska
		return "webm"
	if head[4:8] == b"ftyp":  # ISO base media (M4A / AAC-in-MP4)
		return "mp4"
	if head[0:3] == b"ID3" or head[0:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
		return "mp3"
	if head[0:2] in (b"\xff\xf1", b"\xff\xf9"):  # ADTS AAC
		return "aac"
	return None


@frappe.whitelist(methods=["POST"])
@rate_limit(limit=60, seconds=60)
def save_recording(payload: str) -> dict:
	"""Validate base64 audio, store it as a private file, and create the owning asset."""
	data = _parse(payload)
	content = _decode(data.get("data"))
	if len(content) > MAX_AUDIO_BYTES:
		frappe.throw(_("That audio is larger than the {0} MB limit.").format(MAX_AUDIO_BYTES // (1024 * 1024)))
	fmt = detect_audio_format(content[:16])
	if not fmt:
		frappe.throw(_("That file is not a recognised audio recording."))

	asset = frappe.new_doc(ASSET)
	asset.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or _("Untitled recording")
	asset.source_type = data.get("source_type") if data.get("source_type") in _SOURCE_TYPES else "Recording"
	asset.category = _truncate((data.get("category") or "").strip(), MAX_TITLE) or None
	asset.description = _truncate((data.get("description") or "").strip(), MAX_TEXT) or None
	asset.tags = _join_tags(data.get("tags"))
	asset.duration_seconds = max(flt(data.get("duration_seconds")), 0)
	asset.file_size = len(content)
	asset.container_format = fmt
	asset.created_from_tool = (
		data.get("created_from_tool") if data.get("created_from_tool") in _CREATED_TOOLS else "recorder"
	)
	asset.insert()

	file_doc = save_file(
		f"{_slug(asset.title)}.{_FORMATS[fmt][1]}",
		content,
		ASSET,
		asset.name,
		decode=False,
		is_private=1,
	)
	asset.file = file_doc.file_url
	asset.save()
	return _serialize(asset)


@frappe.whitelist()
@frappe.read_only()
def list_recordings() -> list[dict]:
	rows = frappe.get_all(
		ASSET,
		filters={"owner": frappe.session.user},
		fields=[
			"name", "title", "file", "source_type", "category", "tags", "description",
			"duration_seconds", "file_size", "container_format", "creation", "modified",
		],
		order_by="modified desc",
	)
	for row in rows:
		row["tags"] = _split_tags(row.get("tags"))
		row["creation"] = str(row["creation"]) if row.get("creation") else None
		row["modified"] = str(row["modified"]) if row.get("modified") else None
	return rows


@frappe.whitelist()
@frappe.read_only()
def get_recording(name: str) -> dict:
	"""Return a single owned recording (used to open it in the Audio Editor)."""
	return _serialize(_owned(name))


@frappe.whitelist(methods=["POST"])
def update_recording(payload: str) -> dict:
	"""Rename / re-categorise / re-tag a recording. The audio file itself is immutable here.

	Only fields present in the payload are touched, so a title-only rename never clears the
	recording's category or tags.
	"""
	data = _parse(payload)
	asset = _owned(data.get("name"))
	if "title" in data:
		asset.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or asset.title
	if "category" in data:
		asset.category = _truncate((data.get("category") or "").strip(), MAX_TITLE) or None
	if "description" in data:
		asset.description = _truncate((data.get("description") or "").strip(), MAX_TEXT) or None
	if "tags" in data:
		asset.tags = _join_tags(data.get("tags"))
	asset.save()
	return _serialize(asset)


@frappe.whitelist(methods=["POST"])
def delete_recording(name: str) -> None:
	_owned(name)
	frappe.delete_doc(ASSET, name)  # on_trash removes the private file too


# --- helpers --------------------------------------------------------------------------------


def _decode(value: object) -> bytes:
	if not isinstance(value, str) or not value.strip():
		frappe.throw(_("No audio data was received."))
	raw = value.strip()
	if raw.startswith("data:") and "," in raw:
		raw = raw.split(",", 1)[1]
	try:
		content = base64.b64decode(raw, validate=True)
	except (ValueError, base64.binascii.Error):
		frappe.throw(_("The audio data could not be read."))
	if not content:
		frappe.throw(_("The audio recording is empty."))
	return content


def _serialize(doc) -> dict:
	mime = _FORMATS.get(doc.container_format, ("application/octet-stream", ""))[0]
	return {
		"name": doc.name,
		"title": doc.title,
		"file": doc.file,
		"mime": mime,
		"source_type": doc.source_type,
		"category": doc.category,
		"description": doc.description,
		"tags": _split_tags(doc.tags),
		"duration_seconds": flt(doc.duration_seconds),
		"file_size": cint(doc.file_size),
		"container_format": doc.container_format,
		"modified": str(doc.modified) if doc.modified else None,
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Recording not found."))
	doc = frappe.get_doc(ASSET, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this recording."))
	return doc


def _slug(title: str) -> str:
	slug = re.sub(r"[^a-z0-9]+", "-", (title or "recording").lower()).strip("-")
	return slug or "recording"


def _split_tags(value) -> list[str]:
	return [tag.strip() for tag in value.split(",") if tag.strip()] if value else []


def _join_tags(value) -> str | None:
	if not value:
		return None
	tags = _split_tags(value) if isinstance(value, str) else [str(tag).strip() for tag in value]
	seen: set[str] = set()
	unique: list[str] = []
	for tag in tags:
		key = tag.lower()
		if tag and key not in seen:
			seen.add(key)
			unique.append(tag)
	return ", ".join(unique) or None


def _truncate(text: str, limit: int) -> str:
	return text if len(text) <= limit else text[:limit]


def _parse(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid payload."))
	return data
