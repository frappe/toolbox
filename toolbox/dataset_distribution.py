# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Download layer for the fetch-once-at-install dataset delivery.

The app ships a committed manifest (toolbox/data/manifest.json) that pins, per dataset,
a version and a download URL with a SHA-256. This module downloads one asset defensively:
HTTPS only, size-capped, streamed, and integrity-checked against the manifest checksum
before anything imports it. No user or site data is ever sent — only a GET for public data.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.parse import urlparse

import frappe
import requests
from frappe import _

ASSET_MAX_BYTES = 250 * 1024 * 1024
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 120
CHUNK_SIZE = 256 * 1024
USER_AGENT = "Frappe-Toolbox-dataset-fetch"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


class DatasetDistributionError(frappe.ValidationError):
	pass


def download_asset(url: str, expected_sha256: str, dest: Path) -> None:
	"""Stream a dataset asset to `dest`, then verify it against the manifest SHA-256."""
	expected = (expected_sha256 or "").strip().lower()
	if not expected:
		raise DatasetDistributionError(_("The dataset entry has no checksum to verify against."))
	_validate_url(url)
	digest = hashlib.sha256()
	written = 0
	try:
		with requests.get(
			url, stream=True, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT), headers={"User-Agent": USER_AGENT}
		) as response:
			response.raise_for_status()
			with dest.open("wb") as sink:
				for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
					if not chunk:
						continue
					written += len(chunk)
					if written > ASSET_MAX_BYTES:
						raise DatasetDistributionError(_("The dataset download is too large."))
					digest.update(chunk)
					sink.write(chunk)
	except requests.RequestException as error:
		raise DatasetDistributionError(_("The dataset download failed.")) from error
	if digest.hexdigest() != expected:
		raise DatasetDistributionError(_("The dataset download failed its integrity check."))


def _validate_url(url: str) -> None:
	parsed = urlparse(url or "")
	host = (parsed.hostname or "").lower()
	if parsed.scheme == "https":
		return
	# Loopback http is allowed for air-gapped mirrors and local development only.
	if parsed.scheme == "http" and host in LOOPBACK_HOSTS:
		return
	raise DatasetDistributionError(_("Dataset sources must use HTTPS."))
