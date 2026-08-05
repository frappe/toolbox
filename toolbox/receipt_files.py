# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Magic-byte validation for expense receipts (images and PDF).

Receipts are user-uploaded files, so the type is decided by the file's own leading bytes
(spec §14.3) — never the client's claimed MIME type or file name — against a small allowlist.
Pure and unit-testable.
"""

MAX_RECEIPT_BYTES = 10 * 1024 * 1024  # 10 MB

# Detected type -> (canonical mime, extension). The allowlist is exactly these.
RECEIPT_TYPES = {
	"jpeg": ("image/jpeg", "jpg"),
	"png": ("image/png", "png"),
	"gif": ("image/gif", "gif"),
	"webp": ("image/webp", "webp"),
	"pdf": ("application/pdf", "pdf"),
}


def detect_receipt_type(head: bytes) -> str | None:
	"""Return a receipt type id from the file's leading bytes, or ``None`` if not allowed."""
	if len(head) < 12:
		return None
	if head[0:3] == b"\xff\xd8\xff":
		return "jpeg"
	if head[0:8] == b"\x89PNG\r\n\x1a\n":
		return "png"
	if head[0:4] in (b"GIF8",):
		return "gif"
	if head[0:4] == b"RIFF" and head[8:12] == b"WEBP":
		return "webp"
	if head[0:4] == b"%PDF":
		return "pdf"
	return None
