#!/usr/bin/env python3
"""Build the Weather tool's bundled city dataset from GeoNames' open data.

GeoNames (https://www.geonames.org/, CC BY 4.0) publishes `cities15000`, every settlement
above 15,000 people, as a tab-separated dump. The city name alone does not identify a place
— eight US cities are called Springfield — so this script joins the region and country name
columns from `admin1CodesASCII.txt` and `countryInfo.txt`.

Unlike the other datasets, the result is committed to the repository under `toolbox/data/`
rather than published as a release asset: it is small, static, and changes only when someone
chooses to refresh it.

Usage:
    cd $(mktemp -d)
    curl -O https://download.geonames.org/export/dump/cities15000.zip
    curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
    curl -O https://download.geonames.org/export/dump/countryInfo.txt
    unzip cities15000.zip
    python build_city_dataset.py . <toolbox>/toolbox/data/cities15000.jsonl.gz

Output: one gzipped JSON object per line, sorted by GeoNames id:
    {"id": 1277333, "name": "Bengaluru", "country": "India", "country_code": "IN",
     "admin1": "Karnataka", "latitude": 12.97194, "longitude": 77.59369,
     "timezone": "Asia/Kolkata", "population": 8443675}
"""

from __future__ import annotations

import csv
import gzip
import json
import sys
from pathlib import Path

# cities15000.txt column positions, per https://download.geonames.org/export/dump/readme.txt
GEONAME_ID, NAME, LATITUDE, LONGITUDE = 0, 1, 4, 5
COUNTRY_CODE, ADMIN1_CODE, POPULATION, TIMEZONE, MODIFIED_AT = 8, 10, 14, 17, 18


def build(directory: Path, destination: Path) -> tuple[int, str]:
	regions = read_regions(directory / "admin1CodesASCII.txt")
	countries = read_countries(directory / "countryInfo.txt")
	rows = []
	source_updated_at = ""

	with (directory / "cities15000.txt").open(encoding="utf-8") as source:
		for columns in csv.reader(source, delimiter="\t", quoting=csv.QUOTE_NONE):
			row = normalize(columns, regions, countries)
			if row:
				rows.append(row)
				source_updated_at = max(source_updated_at, columns[MODIFIED_AT])

	rows.sort(key=lambda row: row["id"])
	payload = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows)
	destination.write_bytes(gzip.compress(payload.encode("utf-8"), compresslevel=9, mtime=0))
	return len(rows), source_updated_at


def normalize(columns: list[str], regions: dict[str, str], countries: dict[str, str]) -> dict | None:
	if len(columns) <= MODIFIED_AT or not columns[GEONAME_ID].isdigit():
		return None
	country_code = columns[COUNTRY_CODE]
	return {
		"id": int(columns[GEONAME_ID]),
		"name": columns[NAME],
		"country": countries.get(country_code, ""),
		"country_code": country_code,
		"admin1": regions.get(f"{country_code}.{columns[ADMIN1_CODE]}", ""),
		"latitude": float(columns[LATITUDE]),
		"longitude": float(columns[LONGITUDE]),
		"timezone": columns[TIMEZONE],
		"population": int(columns[POPULATION] or 0),
	}


def read_regions(path: Path) -> dict[str, str]:
	"""Map "US.IL" to "Illinois". This is what separates the eight Springfields."""
	with path.open(encoding="utf-8") as source:
		rows = csv.reader(source, delimiter="\t", quoting=csv.QUOTE_NONE)
		return {row[0]: row[1] for row in rows if len(row) >= 2}


def read_countries(path: Path) -> dict[str, str]:
	"""Map "IN" to "India". countryInfo.txt carries a comment header."""
	countries = {}
	with path.open(encoding="utf-8") as source:
		for line in source:
			if line.startswith("#"):
				continue
			columns = line.rstrip("\n").split("\t")
			if len(columns) > 4 and columns[0]:
				countries[columns[0]] = columns[4]
	return countries


def main(argv: list[str]) -> None:
	if len(argv) != 2:
		raise SystemExit(__doc__)
	directory, destination = Path(argv[0]).resolve(strict=True), Path(argv[1])
	count, source_updated_at = build(directory, destination)
	size = destination.stat().st_size / 1024
	print(f"Wrote {count:,} cities to {destination} ({size:,.0f} KB gzipped)")
	print(f"Newest GeoNames row: {source_updated_at}")


if __name__ == "__main__":
	main(sys.argv[1:])
