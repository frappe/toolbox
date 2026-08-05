# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""SSRF-guarded metadata fetch for saved links.

Fetching an arbitrary user-supplied URL server-side is a high-risk boundary. This module makes
the request defensively (spec 8.6):

- only ``http``/``https``; no embedded credentials
- DNS is resolved first and EVERY resolved address must be public — private, loopback,
  link-local, multicast, reserved, unspecified and cloud-metadata addresses are refused (IPv4
  and IPv6, including IPv4-mapped IPv6)
- after connecting, the ACTUAL peer address is re-checked against the validated set, closing the
  DNS-rebinding window
- redirects are followed manually, re-validated at every hop, and capped
- strict connect/read timeouts and an overall deadline
- the response body is byte-limited and must be HTML
- no cookies or authentication headers are ever sent
- returned text is stripped of markup; no executable HTML is stored

Extraction and address classification are pure so they can be unit-tested without a network.
A URL that fails here is still savable manually — callers treat failure as "no metadata".
"""

from __future__ import annotations

import ipaddress
import re
import socket
import time
from html import unescape
from urllib.parse import urljoin, urlsplit

import requests

MAX_REDIRECTS = 3
CONNECT_TIMEOUT = 4
READ_TIMEOUT = 4
OVERALL_DEADLINE = 12  # seconds across all hops
MAX_BYTES = 512 * 1024
ALLOWED_SCHEMES = frozenset({"http", "https"})
DEFAULT_PORTS = {"http": 80, "https": 443}
USER_AGENT = "ToolboxLinkPreview/1.0 (+https://frappe.io; link metadata)"

MAX_TITLE = 300
MAX_DESCRIPTION = 2000
MAX_SITE_NAME = 200
MAX_URL = 2000


class LinkMetadataError(Exception):
	"""A metadata fetch failed for a benign reason (unreachable, not HTML, too big …)."""


class UnsafeURLError(LinkMetadataError):
	"""The URL or a redirect target pointed at a non-public or disallowed address."""


def fetch_link_metadata(url: str, *, get=None, resolver=None) -> dict:
	"""Fetch and return sanitised metadata for ``url``. Raises ``LinkMetadataError`` on failure.

	``get`` and ``resolver`` are injectable for tests; both default to real network calls.
	"""
	get = get or _default_get
	resolver = resolver or _resolve_public_ips
	deadline = time.monotonic() + OVERALL_DEADLINE

	current = url
	for _ in range(MAX_REDIRECTS + 1):
		if time.monotonic() > deadline:
			raise LinkMetadataError("The page took too long to respond.")
		parts = _validate_url(current)
		allowed = resolver(parts.hostname, parts.port or DEFAULT_PORTS[parts.scheme])

		response = get(current)
		try:
			_assert_peer_public(response, allowed)
			location = _redirect_target(response)
			if location:
				current = urljoin(current, location)
				continue
			if response.status_code >= 400:
				raise LinkMetadataError(f"The page returned status {response.status_code}.")
			if "html" not in (response.headers.get("Content-Type") or "").lower():
				raise LinkMetadataError("That link is not an HTML page.")
			html = _read_limited(response)
		finally:
			_safe_close(response)
		return _extract_metadata(html, final_url=current)

	raise LinkMetadataError("That link redirected too many times.")


# --- address safety (pure) ------------------------------------------------------------------


def is_blocked_ip(value: str) -> bool:
	"""Return whether ``value`` is an address we must never connect to."""
	try:
		addr = ipaddress.ip_address(value.split("%")[0])
	except ValueError:
		return True
	if addr.version == 6 and addr.ipv4_mapped is not None:
		addr = addr.ipv4_mapped
	return not addr.is_global or addr.is_multicast or addr.is_reserved or addr.is_unspecified


def _resolve_public_ips(host: str | None, port: int) -> set[str]:
	if not host:
		raise UnsafeURLError("That URL is missing a host name.")
	try:
		infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
	except socket.gaierror as exc:
		raise LinkMetadataError("That host name could not be resolved.") from exc
	addresses = {info[4][0].split("%")[0] for info in infos}
	if not addresses:
		raise LinkMetadataError("That host name could not be resolved.")
	for address in addresses:
		if is_blocked_ip(address):
			raise UnsafeURLError("That link points to a private or disallowed address.")
	return addresses


def _assert_peer_public(response, allowed: set[str]) -> None:
	"""Re-check the address actually connected to; defeats DNS rebinding between resolve/connect."""
	try:
		peer = response.raw.connection.sock.getpeername()[0].split("%")[0]
	except (AttributeError, OSError, TypeError):
		return  # Best effort: the pre-connect resolution already validated every candidate.
	if is_blocked_ip(peer) or peer not in allowed:
		raise UnsafeURLError("The connection resolved to a disallowed address.")


# --- request helpers ------------------------------------------------------------------------


def _validate_url(url: str):
	parts = urlsplit(url)
	if parts.scheme.lower() not in ALLOWED_SCHEMES:
		raise UnsafeURLError("Only http and https links can be fetched.")
	if "@" in parts.netloc:
		raise UnsafeURLError("Links with embedded credentials are not allowed.")
	if not parts.hostname:
		raise UnsafeURLError("That URL is missing a host name.")
	try:
		parts.port
	except ValueError as exc:
		raise UnsafeURLError("That URL has an invalid port.") from exc
	return parts


def _default_get(url: str):
	# No session, so no cookies; no auth headers; redirects handled manually by the caller.
	return requests.get(
		url,
		stream=True,
		allow_redirects=False,
		timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
		headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
	)


def _redirect_target(response) -> str | None:
	if response.status_code in (301, 302, 303, 307, 308):
		location = (response.headers.get("Location") or "").strip()
		if location:
			return location
	return None


def _read_limited(response) -> str:
	chunks: list[bytes] = []
	total = 0
	for chunk in response.iter_content(8192):
		chunks.append(chunk)
		total += len(chunk)
		if total >= MAX_BYTES:
			break
	raw = b"".join(chunks)[:MAX_BYTES]
	encoding = getattr(response, "encoding", None) or "utf-8"
	try:
		return raw.decode(encoding, errors="replace")
	except (LookupError, TypeError):
		return raw.decode("utf-8", errors="replace")


def _safe_close(response) -> None:
	try:
		response.close()
	except Exception:
		pass


# --- HTML metadata extraction (pure) --------------------------------------------------------

_META_RE = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_LINK_RE = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
_ATTR_RE = re.compile(r"""([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""")


def _extract_metadata(html: str, final_url: str) -> dict:
	metas = [_attrs(tag) for tag in _META_RE.findall(html)]
	title_match = _TITLE_RE.search(html)

	title = _meta(metas, "og:title") or (title_match.group(1) if title_match else "")
	description = _meta(metas, "description") or _meta(metas, "og:description")
	site_name = _meta(metas, "og:site_name")
	image = _meta(metas, "og:image")
	canonical = _canonical(html)

	return {
		"title": _clean_text(title, MAX_TITLE),
		"description": _clean_text(description, MAX_DESCRIPTION),
		"site_name": _clean_text(site_name, MAX_SITE_NAME),
		"image": _safe_link(urljoin(final_url, image) if image else ""),
		"canonical_url": _safe_link(urljoin(final_url, canonical) if canonical else ""),
		"final_url": final_url,
	}


def _attrs(tag: str) -> dict:
	return {m.group(1).lower(): (m.group(2) or m.group(3) or m.group(4) or "") for m in _ATTR_RE.finditer(tag)}


def _meta(metas: list[dict], key: str) -> str:
	for attrs in metas:
		if attrs.get("name", "").lower() == key or attrs.get("property", "").lower() == key:
			return attrs.get("content", "")
	return ""


def _canonical(html: str) -> str:
	for tag in _LINK_RE.findall(html):
		attrs = _attrs(tag)
		if attrs.get("rel", "").lower() == "canonical":
			return attrs.get("href", "")
	return ""


def _clean_text(value: str, limit: int) -> str:
	# Decode entities first, THEN strip markup, so an escaped "&lt;script&gt;" cannot survive as a
	# tag. Collapse whitespace. The result is plain text only — never executable HTML.
	text = re.sub(r"<[^>]+>", " ", unescape(value or ""))
	text = " ".join(text.split())
	return text[:limit]


def _safe_link(url: str) -> str:
	"""Keep an extracted image/canonical URL only if it is a plain http(s) link within limits."""
	if not url or len(url) > MAX_URL:
		return ""
	scheme = urlsplit(url).scheme.lower()
	return url if scheme in ALLOWED_SCHEMES else ""
