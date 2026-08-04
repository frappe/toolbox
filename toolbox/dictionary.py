import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit

from toolbox.dictionary_data import DATASET_TYPE, DICTIONARY_DOCTYPE
from toolbox.india_business_data import RELEASE_DOCTYPE

MAX_SUGGESTIONS = 8
# Widest indexed candidate set an edit-distance ranking may reorder; a hard cap so the
# ranking never runs over more than this many rows (never a full-table scan).
CANDIDATE_POOL = 50
# Longest run of trailing characters trimmed off the query to find near-prefixes.
MAX_TRIM = 3
# Ceiling for the bounded edit distance; candidates beyond it collapse to a single bucket.
MAX_DISTANCE = 5


@frappe.whitelist(methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def get_dataset_status() -> dict[str, object]:
	return {
		"schemaVersion": 1,
		"dictionary": _active_metadata(),
	}


@frappe.whitelist(methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def lookup(word: str) -> dict[str, object]:
	term = _term(word)
	release = _active_release()
	if not release:
		return {"schemaVersion": 1, "state": "unavailable"}

	entry = frappe.db.get_value(
		DICTIONARY_DOCTYPE,
		{"dataset_release": release.name, "normalized_word": term},
		["word", "senses_json"],
		as_dict=True,
	)
	if not entry:
		return {
			"schemaVersion": 1,
			"state": "missing",
			"word": term,
			"suggestions": _suggestions(release.name, term),
		}
	return {
		"schemaVersion": 1,
		"state": "ready",
		"word": entry.word,
		"senses": json.loads(entry.senses_json or "[]"),
		"source": _source(release),
		"sourceUpdatedAt": release.source_updated_at,
	}


@frappe.whitelist(methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def suggest(query: str) -> dict[str, object]:
	term = _term(query)
	release = _active_release()
	if not release:
		return {"schemaVersion": 1, "suggestions": []}
	return {"schemaVersion": 1, "suggestions": _suggestions(release.name, term)}


def _suggestions(release_name: str, term: str) -> list[str]:
	return _rank(term, _candidate_pool(release_name, term))


def _like_prefix(value: str) -> str:
	escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
	return f"{escaped}%"


def _candidate_pool(release_name: str, term: str) -> list[str]:
	"""Gather indexed prefix matches for the term and its near-prefixes. Each prefix is a
	separate range scan on the (dataset_release, normalized_word) composite index, ordered
	and LIMITed so it stops early — the pool never grows past CANDIDATE_POOL rows and never
	triggers a full-release scan."""
	record = frappe.qb.DocType(DICTIONARY_DOCTYPE)
	seen: set = set()
	pool: list = []
	for prefix in _prefixes(term):
		rows = (
			frappe.qb.from_(record)
			.select(record.normalized_word)
			.where((record.dataset_release == release_name) & record.normalized_word.like(_like_prefix(prefix)))
			.orderby(record.normalized_word)
			.limit(CANDIDATE_POOL)
		).run(pluck=True)
		for word in rows:
			if word not in seen:
				seen.add(word)
				pool.append(word)
		if len(pool) >= CANDIDATE_POOL:
			break
	return pool[:CANDIDATE_POOL]


def _rank(term: str, candidates: list[str]) -> list[str]:
	"""Deterministically order the bounded candidate pool by closeness to the term:
	edit distance first, then shorter words, then lexicographic."""
	unique = list(dict.fromkeys(candidates))
	unique.sort(key=lambda word: (_edit_distance(term, word), len(word), word))
	return unique[:MAX_SUGGESTIONS]


def _prefixes(term: str) -> list[str]:
	# Longest prefix first, so exact and near matches rank ahead of broader ones. Trimming
	# trailing characters lets a misspelled or over-long query still reach shorter words.
	shortest = max(1, len(term) - MAX_TRIM)
	return [term[:length] for length in range(len(term), shortest - 1, -1)]


def _edit_distance(source: str, target: str, ceiling: int = MAX_DISTANCE) -> int:
	"""Levenshtein distance with an early cutoff, so a far-off pair costs O(ceiling) work
	instead of the full matrix. Only ever called over the bounded candidate pool."""
	if source == target:
		return 0
	if abs(len(source) - len(target)) > ceiling:
		return ceiling + 1
	previous = list(range(len(target) + 1))
	for row, source_char in enumerate(source, start=1):
		current = [row]
		best = row
		for column, target_char in enumerate(target, start=1):
			cost = 0 if source_char == target_char else 1
			current.append(min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost))
			best = min(best, current[column])
		if best > ceiling:
			return ceiling + 1
		previous = current
	return previous[-1]


def _active_metadata() -> dict[str, object] | None:
	release = _active_release()
	if not release:
		return None
	return {
		"version": release.version,
		"sourceUpdatedAt": release.source_updated_at,
		"importedAt": release.imported_at,
		"recordCount": release.record_count,
		"exclusionCount": release.exclusion_count,
		"source": _source(release),
	}


def _active_release():
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		{"dataset_type": DATASET_TYPE, "status": "Active"},
		["name", "version", "source_updated_at", "imported_at", "record_count", "exclusion_count", "source_name", "source_url", "license_name", "license_url", "attribution"],
		as_dict=True,
	)


def _source(release) -> dict[str, object]:
	return {
		"name": release.source_name,
		"url": release.source_url,
		"license": release.license_name,
		"licenseUrl": release.license_url,
		"attribution": release.attribution,
	}


def _term(query: str) -> str:
	term = " ".join(str(query or "").strip().split()).casefold()
	if len(term) < 1 or len(term) > 80:
		frappe.throw(_("Enter between 1 and 80 characters."))
	return term
