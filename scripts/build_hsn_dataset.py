#!/usr/bin/env python3
"""Build the HSN/SAC tool's staged-import dataset from India Compliance's open data.

India Compliance (https://github.com/resilient-tech/india-compliance, GPLv3) curates the
CBIC GST HSN/SAC classification as a plain {hsn_code, description} list. This script turns
it into the normalized JSONL that `toolbox.hsn_data.import_hsn_jsonl` imports, so the
dataset is reproducible from the public source rather than committed as a blob. Codes
beginning with 99 are Service Accounting Codes (SAC); the rest are goods (HSN).

Usage:
    curl -O https://raw.githubusercontent.com/resilient-tech/india-compliance/develop/india_compliance/gst_india/data/hsn_codes.json
    python build_hsn_dataset.py ./hsn_codes.json ./hsn-sac.jsonl

Output: one JSON object per line, sorted by code:
    {"code": "0101", "code_type": "HSN", "description": "LIVE HORSES, ASSES, MULES AND HINNIES"}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def build(source: Path, destination: Path) -> int:
	records = json.loads(source.read_text(encoding="utf-8"))
	rows: dict[str, dict[str, str]] = {}
	for record in records:
		row = normalize(record)
		if row and row["code"] not in rows:
			rows[row["code"]] = row

	with destination.open("w", encoding="utf-8") as sink:
		for code in sorted(rows):
			sink.write(json.dumps(rows[code], ensure_ascii=False) + "\n")
	return len(rows)


def normalize(record: dict) -> dict[str, str] | None:
	code = str(record.get("hsn_code") or "").strip()
	description = " ".join(str(record.get("description") or "").split())
	if not code.isdigit() or len(code) < 2 or not description:
		return None
	return {
		"code": code,
		"code_type": "SAC" if code.startswith("99") else "HSN",
		"description": description,
	}


def main(argv: list[str]) -> None:
	if len(argv) != 2:
		raise SystemExit(__doc__)
	source, destination = Path(argv[0]).resolve(strict=True), Path(argv[1])
	count = build(source, destination)
	print(f"Wrote {count:,} HSN/SAC records to {destination}")


if __name__ == "__main__":
	main(sys.argv[1:])
