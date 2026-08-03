#!/usr/bin/env python3
"""Publish a curated dataset release for the fetch-once-at-install channel.

Given a source file (the same file `toolbox.<engine>.import_*` consumes), this:
  1. compresses it deterministically to dist/datasets/<asset>  (gzip, fixed mtime so
     the bytes — and therefore the checksum — are reproducible),
  2. records its SHA-256, size, version and source date into toolbox/data/manifest.json.

The maintainer then uploads dist/datasets/<asset> to the `datasets` GitHub release. The
committed manifest pins exactly that asset by checksum, so a deployment fetches it once at
install/update time, verifies it, and imports it. Nothing here is sent anywhere; it only
prepares files. The IFSC/HSN auto-refresh CI runs this same step unattended.

Usage:
    python scripts/publish_dataset.py PIN  <path>/pincode.csv        2026-06-10  2026-06-10
    python scripts/publish_dataset.py IFSC <path>/ifsc.csv           v2.0.61     2026-07-15
    python scripts/publish_dataset.py Dictionary <path>/dictionary.jsonl WordNet-3.1 2011-06-30
    python scripts/publish_dataset.py HSN  <path>/hsn-sac.jsonl      2026-08-01  2026-08-01
"""

from __future__ import annotations

import gzip
import hashlib
import json
import shutil
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = APP_ROOT / "toolbox" / "data" / "manifest.json"
DIST_DIR = APP_ROOT / "dist" / "datasets"
RELEASE_TAG = "datasets"
ASSET_BASE_URL = f"https://github.com/frappe/toolbox/releases/download/{RELEASE_TAG}"

# dataset type -> (asset base name, extension). Extension matches what the import engine reads.
ASSETS = {
	"PIN": ("pincode", "csv"),
	"IFSC": ("ifsc", "csv"),
	"Dictionary": ("dictionary", "jsonl"),
	"HSN": ("hsn-sac", "jsonl"),
}


def publish(dataset_type: str, source: Path, version: str, source_updated_at: str) -> dict:
	if dataset_type not in ASSETS:
		raise SystemExit(f"Unknown dataset type {dataset_type!r}. One of: {', '.join(ASSETS)}.")
	base, extension = ASSETS[dataset_type]
	safe_version = version.replace("/", "-").replace(" ", "-")
	asset_name = f"{base}-{safe_version}.{extension}.gz"

	DIST_DIR.mkdir(parents=True, exist_ok=True)
	asset_path = DIST_DIR / asset_name
	_gzip_deterministic(source, asset_path)

	entry = {
		"version": version,
		"sourceUpdatedAt": source_updated_at,
		"url": f"{ASSET_BASE_URL}/{asset_name}",
		"sha256": _sha256(asset_path),
		"size": asset_path.stat().st_size,
		"format": extension,
		"compression": "gzip",
	}
	_update_manifest(dataset_type, entry)
	return {"asset": asset_path, "entry": entry}


def _gzip_deterministic(source: Path, dest: Path) -> None:
	# mtime=0 keeps the output byte-identical across runs, so the manifest checksum stays
	# valid as long as this exact file is the one uploaded to the release.
	with source.open("rb") as raw, gzip.GzipFile(dest, "wb", compresslevel=9, mtime=0) as gz:
		shutil.copyfileobj(raw, gz)


def _sha256(path: Path) -> str:
	digest = hashlib.sha256()
	with path.open("rb") as handle:
		for chunk in iter(lambda: handle.read(1024 * 1024), b""):
			digest.update(chunk)
	return digest.hexdigest()


def _update_manifest(dataset_type: str, entry: dict) -> None:
	manifest = {"schemaVersion": 1, "datasets": {}}
	if MANIFEST_PATH.exists():
		manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
	manifest.setdefault("datasets", {})[dataset_type] = entry
	MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
	MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str]) -> None:
	if len(argv) != 4:
		raise SystemExit(__doc__)
	dataset_type, source, version, source_updated_at = argv
	result = publish(dataset_type, Path(source).resolve(strict=True), version, source_updated_at)
	entry = result["entry"]
	print(f"Wrote {result['asset']}  ({entry['size']:,} bytes)")
	print(f"  sha256 {entry['sha256']}")
	print(f"Updated {MANIFEST_PATH.relative_to(APP_ROOT)} entry for {dataset_type} {version}.")
	print(f"Next: upload the asset above to the `{RELEASE_TAG}` GitHub release, then commit the manifest.")


if __name__ == "__main__":
	main(sys.argv[1:])
