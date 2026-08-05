# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Unit tests for the SSRF-guarded link metadata fetcher (no real network)."""

import unittest

from toolbox.link_metadata import (
	LinkMetadataError,
	UnsafeURLError,
	_extract_metadata,
	fetch_link_metadata,
	is_blocked_ip,
)

# A globally-routable literal so getaddrinfo stays offline (no DNS lookup for IP literals).
PUBLIC = "1.1.1.1"


class FakeResponse:
	def __init__(self, status_code=200, content_type="text/html", body=b"", location=None):
		self.status_code = status_code
		self.headers = {"Content-Type": content_type}
		if location:
			self.headers["Location"] = location
		self._body = body
		self.encoding = "utf-8"
		self.raw = object()  # no .connection, so the peer-IP check is skipped in tests

	def iter_content(self, size):
		for i in range(0, len(self._body), size):
			yield self._body[i : i + size]

	def close(self):
		pass


def html_page(**extra):
	return (
		"<html><head>"
		"<title>Raw &amp; Title</title>"
		'<meta name="description" content="A tidy summary">'
		'<meta property="og:site_name" content="Example Co">'
		'<meta property="og:image" content="/img/cover.png">'
		'<link rel="canonical" href="https://example.com/canonical">'
		+ extra.get("head", "")
		+ "</head><body>ignored</body></html>"
	).encode()


class TestBlockedIp(unittest.TestCase):
	def test_public_addresses_allowed(self):
		for ip in ("1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"):
			self.assertFalse(is_blocked_ip(ip), ip)

	def test_private_and_special_addresses_blocked(self):
		for ip in (
			"127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254",
			"0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "not-an-ip",
		):
			self.assertTrue(is_blocked_ip(ip), ip)


class TestUrlSafety(unittest.TestCase):
	def test_non_http_scheme_rejected(self):
		for url in ("ftp://1.1.1.1/x", "file:///etc/passwd", "gopher://1.1.1.1"):
			with self.assertRaises(UnsafeURLError):
				fetch_link_metadata(url, get=lambda u: FakeResponse())

	def test_embedded_credentials_rejected(self):
		with self.assertRaises(UnsafeURLError):
			fetch_link_metadata("https://user:pass@1.1.1.1/x", get=lambda u: FakeResponse())

	def test_localhost_and_private_hosts_blocked(self):
		for url in ("http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/latest/meta-data/"):
			with self.assertRaises(UnsafeURLError):
				fetch_link_metadata(url, get=lambda u: FakeResponse())

	def test_redirect_to_private_is_blocked(self):
		# First hop is a public literal; it redirects to loopback, which must be refused.
		def get(url):
			return FakeResponse(status_code=302, location="http://127.0.0.1/admin")

		with self.assertRaises(UnsafeURLError):
			fetch_link_metadata(f"https://{PUBLIC}/start", get=get)


class TestFetchBehaviour(unittest.TestCase):
	def test_successful_fetch_returns_sanitised_metadata(self):
		meta = fetch_link_metadata(f"https://{PUBLIC}/page", get=lambda u: FakeResponse(body=html_page()))
		self.assertEqual(meta["title"], "Raw & Title")
		self.assertEqual(meta["description"], "A tidy summary")
		self.assertEqual(meta["site_name"], "Example Co")
		self.assertEqual(meta["image"], f"https://{PUBLIC}/img/cover.png")
		self.assertEqual(meta["canonical_url"], "https://example.com/canonical")

	def test_non_html_is_rejected(self):
		with self.assertRaises(LinkMetadataError):
			fetch_link_metadata(f"https://{PUBLIC}/data", get=lambda u: FakeResponse(content_type="application/json"))

	def test_error_status_is_rejected(self):
		with self.assertRaises(LinkMetadataError):
			fetch_link_metadata(f"https://{PUBLIC}/missing", get=lambda u: FakeResponse(status_code=404))

	def test_too_many_redirects(self):
		def get(url):
			return FakeResponse(status_code=302, location=f"https://{PUBLIC}/next")

		with self.assertRaises(LinkMetadataError):
			fetch_link_metadata(f"https://{PUBLIC}/start", get=get)

	def test_body_is_byte_limited(self):
		big = b"<title>ok</title>" + b"x" * (5 * 1024 * 1024)
		meta = fetch_link_metadata(f"https://{PUBLIC}/big", get=lambda u: FakeResponse(body=big))
		self.assertEqual(meta["title"], "ok")


class TestExtraction(unittest.TestCase):
	def test_markup_and_entities_are_neutralised(self):
		html = (
			'<title>Hi</title>'
			'<meta name="description" content="&lt;script&gt;alert(1)&lt;/script&gt; safe">'
		)
		meta = _extract_metadata(html, final_url="https://example.com/")
		self.assertNotIn("<script>", meta["description"])
		self.assertIn("safe", meta["description"])

	def test_og_title_preferred_over_title_tag(self):
		html = '<title>Fallback</title><meta property="og:title" content="Primary">'
		self.assertEqual(_extract_metadata(html, "https://x.test/")["title"], "Primary")

	def test_non_http_image_is_dropped(self):
		html = '<meta property="og:image" content="javascript:alert(1)">'
		self.assertEqual(_extract_metadata(html, "https://x.test/")["image"], "")
