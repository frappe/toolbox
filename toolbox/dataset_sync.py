# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Fetch-once-at-install dataset delivery.

The app ships a committed manifest (toolbox/data/manifest.json) pinning, per dataset, a
version and a checksummed source. On migrate we import any dataset whose pinned version
differs from what is active on this site. A fresh install self-provisions; an app update
that bumps a dataset pulls the new release. There are no runtime or scheduled network
calls — only this one-time-per-version fetch of public reference data.

A dataset entry names either a `url` to download or a `path` bundled inside the app. The
city dataset is bundled because it is small and static, so Weather geocodes offline from
the moment the app is installed.

Design guarantees:
- Idempotent: an unchanged dataset (pinned version == active version) is skipped, so a
  normal migrate does no downloads.
- Isolated: one dataset failing never blocks the others, and never disturbs the currently
  active data (the import engine only activates a validated, checksum-verified release).
"""

from __future__ import annotations

import gzip
import json
import shutil
import tempfile
from pathlib import Path

import frappe

from toolbox.dataset_distribution import copy_bundled_asset, download_asset
from toolbox.india_business_data import RELEASE_DOCTYPE

# Dataset type -> import entry point. Each takes (path, version, source_updated_at) and
# runs the staged-release engine (validate, atomically activate, keep prior for rollback).
IMPORT_METHODS = {
	"Dictionary": "toolbox.dictionary_data.import_dictionary_jsonl",
	"PIN": "toolbox.india_business_data.import_pin_csv",
	"IFSC": "toolbox.india_business_data.import_ifsc_csv",
	"HSN": "toolbox.hsn_data.import_hsn_jsonl",
	"City": "toolbox.city_data.import_city_jsonl",
}


def sync_datasets(force: bool = False) -> dict[str, list[str]]:
	"""Import every bundled dataset whose pinned version differs from the active one."""
	results: dict[str, list[str]] = {"synced": [], "skipped": [], "failed": []}
	manifest = load_manifest()
	if not manifest:
		return results
	for dataset_type, entry in manifest["datasets"].items():
		if dataset_type not in IMPORT_METHODS:
			continue
		try:
			results[_sync_one(dataset_type, entry, force)].append(dataset_type)
		except Exception:
			frappe.log_error(title=f"Toolbox {dataset_type} dataset sync failed")
			results["failed"].append(dataset_type)
	return results


def after_migrate() -> None:
	"""Enqueue a dataset sync after each migrate. Skipped during tests."""
	if frappe.flags.in_test:
		return
	if not load_manifest():
		return
	frappe.enqueue(
		"toolbox.dataset_sync.sync_datasets",
		queue="long",
		timeout=1800,
		enqueue_after_commit=True,
	)


def load_manifest() -> dict | None:
	"""Return the committed manifest if present and well-formed, else None."""
	path = manifest_path()
	if not path.exists():
		return None
	try:
		data = json.loads(path.read_text(encoding="utf-8"))
	except ValueError:
		return None
	if int(data.get("schemaVersion") or 0) != 1 or not isinstance(data.get("datasets"), dict):
		return None
	return data


def manifest_path() -> Path:
	return Path(frappe.get_app_path("toolbox", "data", "manifest.json"))


def _sync_one(dataset_type: str, entry: dict, force: bool) -> str:
	version = str(entry.get("version") or "").strip()
	if not version:
		return "skipped"
	if not force and _active_version(dataset_type) == version:
		return "skipped"
	_install(dataset_type, entry, version)
	return "synced"


def _install(dataset_type: str, entry: dict, version: str) -> None:
	source_updated_at = str(entry.get("sourceUpdatedAt") or "")
	import_method = frappe.get_attr(IMPORT_METHODS[dataset_type])
	with tempfile.TemporaryDirectory(prefix="toolbox-dataset-") as directory:
		asset = Path(directory) / "asset"
		_fetch_asset(entry, asset)
		import_method(str(_decompress(asset, entry)), version, source_updated_at)


def _fetch_asset(entry: dict, asset: Path) -> None:
	"""Take the dataset from wherever the manifest pins it: bundled in the app, or a URL."""
	checksum = str(entry.get("sha256") or "")
	bundled = str(entry.get("path") or "")
	if bundled:
		copy_bundled_asset(bundled, checksum, asset)
	else:
		download_asset(str(entry.get("url") or ""), checksum, asset)


def _decompress(asset: Path, entry: dict) -> Path:
	if str(entry.get("compression") or "").lower() != "gzip":
		return asset
	target = asset.with_name("asset.data")
	with gzip.open(asset, "rb") as source, target.open("wb") as sink:
		shutil.copyfileobj(source, sink)
	return target


def _active_version(dataset_type: str) -> str | None:
	return frappe.db.get_value(
		RELEASE_DOCTYPE, {"dataset_type": dataset_type, "status": "Active"}, "version"
	)
