#!/usr/bin/env python3
"""Keep the canonical datasets current, hands-off (run by CI, no Frappe/bench needed).

For each automatable dataset it asks the upstream source for the latest version and, if
that differs from the committed manifest, rebuilds the normalized asset + updates the
manifest (via publish_dataset.py). The CI workflow then uploads the new asset to the
`datasets` release and opens a PR. Deployments pick it up on their next app update.

Automatable sources:
  IFSC  -> Razorpay IFSC GitHub releases (latest tag + IFSC.csv asset)
  HSN   -> India Compliance's hsn_codes.json (version = that file's last-commit date)

Not here on purpose:
  PIN         -> data.gov.in bot-blocks automation and mirrors are staler than our data;
                 refresh manually with publish_dataset.py.
  Dictionary  -> WordNet 3.1 is frozen; nothing to refresh.

Usage:
  python scripts/refresh_datasets.py check            # report only, no writes
  python scripts/refresh_datasets.py refresh [IFSC HSN]
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_hsn_dataset
import publish_dataset

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "toolbox" / "data" / "manifest.json"
USER_AGENT = "Frappe-Toolbox-dataset-refresh"
IC_HSN_RAW = "https://raw.githubusercontent.com/resilient-tech/india-compliance/develop/india_compliance/gst_india/data/hsn_codes.json"
IC_HSN_COMMITS = "https://api.github.com/repos/resilient-tech/india-compliance/commits?path=india_compliance/gst_india/data/hsn_codes.json&per_page=1"


def source_ifsc() -> dict:
	release = _get_json("https://api.github.com/repos/razorpay/ifsc/releases/latest")
	asset = next(a for a in release["assets"] if a["name"] == "IFSC.csv")

	def fetch(directory: Path) -> Path:
		path = directory / "ifsc.csv"
		_download(asset["browser_download_url"], path)
		return path

	return {"version": release["tag_name"], "sourceUpdatedAt": release["published_at"][:10], "fetch": fetch}


def source_hsn() -> dict:
	commit_date = _get_json(IC_HSN_COMMITS)[0]["commit"]["committer"]["date"][:10]

	def fetch(directory: Path) -> Path:
		raw = directory / "hsn_codes.json"
		_download(IC_HSN_RAW, raw)
		out = directory / "hsn-sac.jsonl"
		build_hsn_dataset.build(raw, out)
		return out

	return {"version": commit_date, "sourceUpdatedAt": commit_date, "fetch": fetch}


SOURCES = {"IFSC": source_ifsc, "HSN": source_hsn}


def check() -> list[str]:
	manifest = _load_manifest()
	stale = []
	for dataset_type, resolver in SOURCES.items():
		source = resolver()
		current = manifest["datasets"].get(dataset_type, {}).get("version")
		if current == source["version"]:
			print(f"{dataset_type}: up to date ({current})")
		else:
			print(f"{dataset_type}: update available ({current} -> {source['version']})")
			stale.append(dataset_type)
	return stale


def refresh(targets: list[str]) -> list[str]:
	manifest = _load_manifest()
	changed = []
	with TemporaryDirectory(prefix="toolbox-refresh-") as directory:
		for dataset_type in targets:
			source = SOURCES[dataset_type]()
			if manifest["datasets"].get(dataset_type, {}).get("version") == source["version"]:
				print(f"{dataset_type}: up to date, skipping")
				continue
			path = source["fetch"](Path(directory))
			publish_dataset.publish(dataset_type, path, source["version"], source["sourceUpdatedAt"])
			print(f"{dataset_type}: refreshed to {source['version']}")
			changed.append(dataset_type)
	return changed


def _get_json(url: str) -> object:
	request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"})
	with urllib.request.urlopen(request, timeout=30) as response:
		return json.loads(response.read())


def _download(url: str, dest: Path) -> None:
	request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
	with urllib.request.urlopen(request, timeout=120) as response, dest.open("wb") as sink:
		while chunk := response.read(256 * 1024):
			sink.write(chunk)


def _load_manifest() -> dict:
	return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def main(argv: list[str]) -> int:
	command = argv[0] if argv else "check"
	if command == "check":
		return 1 if check() else 0
	if command == "refresh":
		targets = argv[1:] or list(SOURCES)
		unknown = [t for t in targets if t not in SOURCES]
		if unknown:
			raise SystemExit(f"Unknown dataset(s): {', '.join(unknown)}. Automatable: {', '.join(SOURCES)}.")
		changed = refresh(targets)
		print(f"changed: {' '.join(changed) if changed else '(none)'}")
		return 0
	raise SystemExit(__doc__)


if __name__ == "__main__":
	raise SystemExit(main(sys.argv[1:]))
