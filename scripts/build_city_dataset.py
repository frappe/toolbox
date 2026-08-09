#!/usr/bin/env python3
"""Build the Weather tool's bundled city dataset from GeoNames' open data.

GeoNames (https://www.geonames.org/, CC BY 4.0) publishes `cities15000`, every settlement
above 15,000 people, as a tab-separated dump. The city name alone does not identify a place
— eight US cities are called Springfield — so this script joins the region and country name
columns from `admin1CodesASCII.txt` and `countryInfo.txt`.

GeoNames names a city in whichever language it judges most common, which is usually English:
Munich, Rome, Naples. So each city also carries the names it is known by locally, read from
`alternateNames.txt`. That file is the one with language tags; the `alternatenames` column
inside `cities15000.txt` is an untagged alphabetical list, and taking the first few names
from it yields "minga" and "muc" rather than "München".

A name is kept when it is tagged with one of the country's own languages or with English, or
when GeoNames left it untagged but marked it preferred, which is how romanisations such as
"Moskva" are recorded. Historic names are kept deliberately: "Bombay" and "Calcutta" are
still typed, and an alias is only ever a search key, never something the interface shows.
Colloquial names are dropped, because they are nicknames rather than names.

Unlike the other datasets, the result is committed to the repository under `toolbox/data/`
rather than published as a release asset: it is small, static, and changes only when someone
chooses to refresh it.

Usage:
    cd $(mktemp -d)
    curl -O https://download.geonames.org/export/dump/cities15000.zip
    curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
    curl -O https://download.geonames.org/export/dump/countryInfo.txt
    curl -O https://download.geonames.org/export/dump/alternateNames.zip
    unzip cities15000.zip && unzip alternateNames.zip
    python build_city_dataset.py . <toolbox>/toolbox/data/cities15000.jsonl.gz

`alternateNames.zip` is about 190 MB and expands to about 740 MB. It is read once here and
never shipped.

Output: one gzipped JSON object per line, sorted by GeoNames id:
    {"id": 1277333, "name": "Bengaluru", "country": "India", "country_code": "IN",
     "admin1": "Karnataka", "latitude": 12.97194, "longitude": 77.59369,
     "timezone": "Asia/Kolkata", "population": 8443675, "alias": ["bangalore"]}
"""

from __future__ import annotations

import csv
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from toolbox.city_names import search_name

# cities15000.txt column positions, per https://download.geonames.org/export/dump/readme.txt
GEONAME_ID, NAME, LATITUDE, LONGITUDE = 0, 1, 4, 5
COUNTRY_CODE, ADMIN1_CODE, POPULATION, TIMEZONE, MODIFIED_AT = 8, 10, 14, 17, 18

# alternateNames.txt column positions, from the same readme.
ALT_GEONAME_ID, ALT_LANGUAGE, ALT_NAME, ALT_IS_PREFERRED, ALT_IS_COLLOQUIAL = 1, 2, 3, 4, 6

# countryInfo.txt: ISO code and the comma-separated locale list.
COUNTRY_ISO, COUNTRY_NAME, COUNTRY_LANGUAGES = 0, 4, 15

MAX_ALIAS_LENGTH = 60


def build(directory: Path, destination: Path) -> tuple[int, int, str]:
	regions = read_regions(directory / "admin1CodesASCII.txt")
	countries, languages = read_countries(directory / "countryInfo.txt")
	rows: dict[str, dict] = {}
	source_updated_at = ""

	with (directory / "cities15000.txt").open(encoding="utf-8") as source:
		for columns in csv.reader(source, delimiter="\t", quoting=csv.QUOTE_NONE):
			row = normalize(columns, regions, countries)
			if row:
				rows[columns[GEONAME_ID]] = row
				source_updated_at = max(source_updated_at, columns[MODIFIED_AT])

	aliases = read_aliases(directory / "alternateNames.txt", rows, languages)
	for geoname_id, names in aliases.items():
		rows[geoname_id]["alias"] = sorted(names)

	ordered = sorted(rows.values(), key=lambda row: row["id"])
	payload = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in ordered)
	destination.write_bytes(gzip.compress(payload.encode("utf-8"), compresslevel=9, mtime=0))
	return len(ordered), sum(len(names) for names in aliases.values()), source_updated_at


def read_aliases(path: Path, rows: dict[str, dict], languages: dict[str, set[str]]) -> dict[str, set[str]]:
	"""Collect the names each city is known by, folded the way search folds a query.

	Reading 19 million rows to keep about 24,000 is the cost of having language tags at all.
	"""
	aliases: dict[str, set[str]] = {}
	primary = {geoname_id: search_name(row["name"]) for geoname_id, row in rows.items()}
	with path.open(encoding="utf-8") as source:
		for columns in csv.reader(source, delimiter="\t", quoting=csv.QUOTE_NONE):
			if len(columns) <= ALT_NAME:
				continue
			geoname_id = columns[ALT_GEONAME_ID]
			row = rows.get(geoname_id)
			if row is None or not _wanted(columns, languages.get(row["country_code"], set())):
				continue
			folded = search_name(columns[ALT_NAME])
			if folded and folded != primary[geoname_id] and len(folded) <= MAX_ALIAS_LENGTH:
				aliases.setdefault(geoname_id, set()).add(folded)
	return aliases


def _wanted(columns: list[str], official: set[str]) -> bool:
	# Colloquial means a nickname: Jakarta is "the Big Durian" and Murmansk is "the fish
	# capital". Nobody searches for a city that way, and both would rank above real matches.
	if len(columns) > ALT_IS_COLLOQUIAL and columns[ALT_IS_COLLOQUIAL] == "1":
		return False
	language = columns[ALT_LANGUAGE]
	if language:
		return language == "en" or language in official
	# No tag means a romanisation or a link; GeoNames marks the useful ones preferred.
	return len(columns) > ALT_IS_PREFERRED and columns[ALT_IS_PREFERRED] == "1"


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


def read_countries(path: Path) -> tuple[dict[str, str], dict[str, set[str]]]:
	"""Map "IN" to "India" and to the languages spoken there. Skips the comment header."""
	countries: dict[str, str] = {}
	languages: dict[str, set[str]] = {}
	with path.open(encoding="utf-8") as source:
		for line in source:
			if line.startswith("#"):
				continue
			columns = line.rstrip("\n").split("\t")
			if len(columns) <= COUNTRY_LANGUAGES or not columns[COUNTRY_ISO]:
				continue
			countries[columns[COUNTRY_ISO]] = columns[COUNTRY_NAME]
			# "de-CH,fr-CH,it-CH,rm" describes four languages, not four locales.
			languages[columns[COUNTRY_ISO]] = {
				locale.split("-")[0] for locale in columns[COUNTRY_LANGUAGES].split(",") if locale
			}
	return countries, languages


def main(argv: list[str]) -> None:
	if len(argv) != 2:
		raise SystemExit(__doc__)
	directory, destination = Path(argv[0]).resolve(strict=True), Path(argv[1])
	count, alias_count, source_updated_at = build(directory, destination)
	size = destination.stat().st_size / 1024
	print(f"Wrote {count:,} cities and {alias_count:,} aliases to {destination} ({size:,.0f} KB gzipped)")
	print(f"Newest GeoNames row: {source_updated_at}")


if __name__ == "__main__":
	main(sys.argv[1:])
