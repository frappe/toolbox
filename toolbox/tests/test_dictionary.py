import hashlib
import json
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from toolbox.dictionary import (
	_edit_distance,
	_prefixes,
	_rank,
	get_dataset_status,
	lookup,
	suggest,
)
from toolbox.dictionary_data import normalize_dictionary_row, stage_rows


class TestDictionaryData(UnitTestCase):
	def test_normalizes_a_complete_entry(self) -> None:
		row = normalize_dictionary_row({
			"word": "  Dog  ",
			"senses": [{"pos": "noun", "definition": "a member of the genus Canis"}],
		})

		self.assertEqual(row["word"], "Dog")
		self.assertEqual(row["normalized_word"], "dog")
		self.assertEqual(row["business_key"], "dog")
		self.assertEqual(json.loads(row["senses_json"])[0]["pos"], "noun")

	def test_excludes_entries_without_a_word_or_senses(self) -> None:
		self.assertIsNone(normalize_dictionary_row({"word": "", "senses": [{"pos": "noun"}]}))
		self.assertIsNone(normalize_dictionary_row({"word": "dog", "senses": []}))
		self.assertIsNone(normalize_dictionary_row({"word": "dog"}))
		self.assertIsNone(normalize_dictionary_row({"word": "dog", "senses": "noun"}))
		self.assertIsNone(normalize_dictionary_row(None))

	def test_staging_counts_records_duplicates_and_exclusions(self) -> None:
		lines = [
			json.dumps({"word": "Dog", "senses": [{"pos": "noun", "definition": "canine"}]}),
			"   ",
			json.dumps({"word": "dog", "senses": [{"pos": "noun", "definition": "again"}]}),
			json.dumps({"word": "", "senses": [{"pos": "noun"}]}),
			"{ not valid json",
		]

		with patch("toolbox.dictionary_data._bulk_insert") as bulk_insert:
			result = stage_rows(lines, "dictionary:release")

		self.assertEqual(result, {"record_count": 1, "exclusion_count": 2, "duplicate_count": 1})
		inserted = bulk_insert.call_args.args[0][0]
		# name is the stable hash of the release-scoped key; the key is not stored.
		expected_key = "dictionary:release:dog"
		self.assertEqual(inserted["name"], hashlib.sha256(expected_key.encode()).hexdigest()[:40])
		self.assertEqual(inserted["normalized_word"], "dog")
		self.assertNotIn("business_key", inserted)


class TestDictionaryApi(UnitTestCase):
	def test_public_endpoints_are_guest_get_only(self) -> None:
		for endpoint in (get_dataset_status, lookup, suggest):
			with self.subTest(endpoint=endpoint.__name__):
				self.assertIn(endpoint, frappe.guest_methods)
				self.assertEqual(
					frappe.allowed_http_methods_for_whitelisted_func[endpoint],
					("GET", "QUERY"),
				)

	def test_lookup_and_suggest_reject_empty_and_unbounded_queries(self) -> None:
		for endpoint in (lookup, suggest):
			with self.subTest(endpoint=endpoint.__name__):
				with self.assertRaises(frappe.ValidationError):
					endpoint("")
				with self.assertRaises(frappe.ValidationError):
					endpoint("a" * 81)

	def test_endpoints_report_unavailable_without_an_active_release(self) -> None:
		with patch("toolbox.dictionary._active_release", return_value=None):
			self.assertEqual(lookup("dog"), {"schemaVersion": 1, "state": "unavailable"})
			self.assertEqual(suggest("dog"), {"schemaVersion": 1, "suggestions": []})
			self.assertEqual(get_dataset_status(), {"schemaVersion": 1, "dictionary": None})

	def test_suggestions_are_deterministic_closest_first(self) -> None:
		ranked = _rank("dog", ["doggy", "dog", "dogs", "dogma", "dog"])
		# distance 0 (dog), then 1 (dogs), then the distance-2 pair by length then spelling.
		self.assertEqual(ranked, ["dog", "dogs", "doggy", "dogma"])

	def test_edit_distance_is_bounded(self) -> None:
		self.assertEqual(_edit_distance("dog", "dog"), 0)
		self.assertEqual(_edit_distance("dog", "dogs"), 1)
		self.assertEqual(_edit_distance("dog", "cat"), 3)
		# A far-off pair collapses to the ceiling bucket rather than a full computation.
		self.assertEqual(_edit_distance("dog", "elephantine", ceiling=2), 3)

	def test_prefixes_trim_trailing_characters_longest_first(self) -> None:
		self.assertEqual(_prefixes("doggo"), ["doggo", "dogg", "dog", "do"])
		self.assertEqual(_prefixes("a"), ["a"])
