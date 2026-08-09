# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Asset layer for the fetch-once-at-install dataset delivery.

The app ships a committed manifest (toolbox/data/manifest.json) that pins, per dataset, a
version and a SHA-256. Large datasets name a download URL; small static ones name a file
bundled inside the app. Either way the asset is integrity-checked against the manifest
checksum before anything imports it.

A download is defensive: HTTPS only, size-capped, and streamed. No user or site data is
ever sent — only a GET for public data.
"""

from __future__ import annotations

import hashlib
import shutil
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
	expected = _expected_checksum(expected_sha256)
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


def copy_bundled_asset(file_name: str, expected_sha256: str, dest: Path) -> None:
	"""Copy a dataset shipped inside the app to `dest`, then verify its SHA-256.

	The asset is copied out rather than read in place so that decompression and import write
	to a temporary directory, never into the installed app.
	"""
	expected = _expected_checksum(expected_sha256)
	shutil.copyfile(_bundled_path(file_name), dest)
	if _file_sha256(dest) != expected:
		raise DatasetDistributionError(_("The bundled dataset failed its integrity check."))


def _bundled_path(file_name: str) -> Path:
	"""Resolve a manifest file name inside the app's data directory and nowhere else."""
	root = Path(frappe.get_app_path("toolbox", "data")).resolve()
	candidate = (root / (file_name or "")).resolve()
	if candidate.parent != root or not candidate.is_file():
		raise DatasetDistributionError(_("The bundled dataset is missing."))
	return candidate


def _file_sha256(path: Path) -> str:
	digest = hashlib.sha256()
	with path.open("rb") as source:
		for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
			digest.update(chunk)
	return digest.hexdigest()


def _expected_checksum(value: str) -> str:
	checksum = (value or "").strip().lower()
	if not checksum:
		raise DatasetDistributionError(_("The dataset entry has no checksum to verify against."))
	return checksum


def _validate_url(url: str) -> None:
	parsed = urlparse(url or "")
	host = (parsed.hostname or "").lower()
	if parsed.scheme == "https":
		return
	# Loopback http is allowed for air-gapped mirrors and local development only.
	if parsed.scheme == "http" and host in LOOPBACK_HOSTS:
		return
	raise DatasetDistributionError(_("Dataset sources must use HTTPS."))
