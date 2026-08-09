# Place names are the subject of these tests, so confusable letters are the point.
# ruff: noqa: RUF001

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from toolbox.city_data import (
	ALIAS_DOCTYPE,
	CITY_DOCTYPE,
	city_aliases,
	import_city_jsonl,
	normalize_city_row,
	stage_rows,
)
from toolbox.city_names import search_name
from toolbox.india_business_data import RELEASE_DOCTYPE
from toolbox.weather import LocationSearchService

SAMPLE = (
	'{"id": 1277333, "name": "Bengaluru", "country": "India", "country_code": "IN", "admin1": "Karnataka",'
	' "latitude": 12.97194, "longitude": 77.59369, "timezone": "Asia/Kolkata", "population": 8495492, "alias": ["bangalore", "bengalooru"]}\n'
	'{"id": 2657896, "name": "Z\\u00fcrich", "country": "Switzerland", "country_code": "CH", "admin1": "Zurich",'
	' "latitude": 47.36667, "longitude": 8.55, "timezone": "Europe/Zurich", "population": 415367}\n'
	'{"id": 4409896, "name": "Springfield", "country": "United States", "country_code": "US", "admin1": "Missouri",'
	' "latitude": 37.21533, "longitude": -93.29824, "timezone": "America/Chicago", "population": 170188}\n'
	'{"id": 4250542, "name": "Springfield", "country": "United States", "country_code": "US", "admin1": "Illinois",'
	' "latitude": 39.80172, "longitude": -89.64371, "timezone": "America/Chicago", "population": 114394}\n'
	'{"id": 5128581, "name": "New York City", "country": "United States", "country_code": "US", "admin1": "New York",'
	' "latitude": 40.71427, "longitude": -74.00597, "timezone": "America/New_York", "population": 8804190, "alias": ["nueva york", "new amsterdam"]}\n'
)


class TestCityData(UnitTestCase):
	def test_folds_accents_and_case_for_search(self) -> None:
		self.assertEqual(search_name("Zürich"), "zurich")
		self.assertEqual(search_name("São Paulo"), "sao paulo")
		self.assertEqual(search_name("  MÁLAGA  "), "malaga")

	def test_folds_the_letters_that_do_not_decompose(self) -> None:
		"""NFKD leaves these alone, so without a rule of their own they cannot be typed."""
		for name, typed in (
			("Tromsø", "tromso"),
			("Łódź", "lodz"),
			("Diyarbakır", "diyarbakir"),
			("Ærøskøbing", "aeroskobing"),
			("Gießen", "giessen"),
			("Đà Nẵng", "da nang"),
		):
			with self.subTest(name=name):
				self.assertEqual(search_name(name), typed)

	def test_drops_typographic_punctuation_nobody_types(self) -> None:
		self.assertEqual(search_name("Xi’an"), "xian")
		self.assertEqual(search_name("Xi'an"), "xian")
		self.assertEqual(search_name("N’Djamena"), "ndjamena")

	def test_collapses_whitespace_so_a_query_matches_a_stored_name(self) -> None:
		self.assertEqual(search_name(" Den  Haag "), "den haag")
		self.assertEqual(search_name(None), "")

	def test_collects_aliases_without_repeating_the_city_s_own_name(self) -> None:
		aliases = city_aliases({"alias": ["Bangalore", "bangalore", "Bengaluru", "Bengalooru"]}, "bengaluru")

		self.assertEqual(aliases, ["bangalore", "bengalooru"])

	def test_ignores_a_missing_or_malformed_alias_field(self) -> None:
		for row in ({}, {"alias": None}, {"alias": "bangalore"}, None):
			with self.subTest(row=row):
				self.assertEqual(city_aliases(row, "bengaluru"), [])

	def test_drops_an_alias_too_long_to_be_a_name(self) -> None:
		self.assertEqual(city_aliases({"alias": ["x" * 61]}, "somewhere"), [])

	def test_normalizes_a_row_and_derives_the_search_name(self) -> None:
		row = normalize_city_row({
			"id": 2657896,
			"name": "Zürich",
			"country": "Switzerland",
			"country_code": "ch",
			"admin1": "Zurich",
			"latitude": 47.36667,
			"longitude": 8.55,
			"timezone": "Europe/Zurich",
			"population": 415367,
		})
		self.assertEqual(row["search_name"], "zurich")
		self.assertEqual(row["country_code"], "CH")
		self.assertEqual(row["geoname_id"], 2657896)

	def test_rejects_rows_without_an_identity_or_a_place_on_earth(self) -> None:
		base = {"id": 1, "name": "Somewhere", "latitude": 1.0, "longitude": 1.0}
		self.assertIsNone(normalize_city_row({**base, "id": None}))
		self.assertIsNone(normalize_city_row({**base, "name": ""}))
		self.assertIsNone(normalize_city_row({**base, "latitude": 91}))
		self.assertIsNone(normalize_city_row({**base, "longitude": -181}))
		self.assertIsNone(normalize_city_row({**base, "latitude": "north"}))
		self.assertIsNone(normalize_city_row(None))

	def test_staging_deduplicates_by_geonames_id(self) -> None:
		lines = [
			'{"id": 1, "name": "A", "latitude": 1, "longitude": 1, "alias": ["aa", "ab"]}',
			'{"id": 1, "name": "A", "latitude": 1, "longitude": 1}',
			'{"id": 2, "name": "", "latitude": 1, "longitude": 1}',
			"not json",
		]
		with patch.object(frappe.db, "bulk_insert") as bulk_insert:
			result = stage_rows(lines, "release-1")
		self.assertEqual(result["record_count"], 1)
		self.assertEqual(result["duplicate_count"], 1)
		self.assertEqual(result["exclusion_count"], 2)
		self.assertEqual(result["alias_count"], 2)
		# One flush for the city table and one for the alias table.
		self.assertEqual([call.args[0] for call in bulk_insert.call_args_list], [CITY_DOCTYPE, ALIAS_DOCTYPE])


class TestCityImportAndSearch(IntegrationTestCase):
	def setUp(self) -> None:
		self._purge()
		with TemporaryDirectory() as directory:
			path = Path(directory) / "cities.jsonl"
			path.write_text(SAMPLE, encoding="utf-8")
			self.release = import_city_jsonl(str(path), "2026-08-08", "2026-08-08")

	def tearDown(self) -> None:
		self._purge()

	@staticmethod
	def _purge() -> None:
		frappe.db.rollback()
		frappe.db.delete(ALIAS_DOCTYPE)
		frappe.db.delete(CITY_DOCTYPE)
		frappe.db.delete(RELEASE_DOCTYPE, {"dataset_type": "City"})
		frappe.db.commit()

	def test_import_activates_the_release(self) -> None:
		self.assertEqual(self.release["status"], "Active")
		self.assertEqual(self.release["record_count"], 5)
		self.assertEqual(self.release["alias_count"], 4)

	def test_search_returns_the_shape_the_frontend_expects(self) -> None:
		result = LocationSearchService().search("Bengaluru")

		self.assertEqual(result["schemaVersion"], 1)
		self.assertEqual(result["source"]["license_name"], "CC BY 4.0")
		self.assertEqual(
			result["results"][0],
			{
				"id": 1277333,
				"name": "Bengaluru",
				"latitude": 12.97194,
				"longitude": 77.59369,
				"country": "India",
				"countryCode": "IN",
				"admin1": "Karnataka",
				"timezone": "Asia/Kolkata",
				"population": 8495492,
			},
		)

	def test_search_folds_accents_so_an_ascii_query_finds_the_place(self) -> None:
		self.assertEqual(LocationSearchService().search("zurich")["results"][0]["name"], "Zürich")

	def test_same_name_places_are_separated_by_region_and_ranked_by_population(self) -> None:
		results = LocationSearchService().search("Springfield")["results"]

		self.assertEqual([row["admin1"] for row in results], ["Missouri", "Illinois"])

	def test_a_contained_name_is_reachable_when_nothing_starts_with_the_term(self) -> None:
		"""Nobody types the start of "New York City" when they type "york"."""
		results = LocationSearchService().search("york")["results"]

		self.assertEqual([row["name"] for row in results], ["New York City"])

	def test_a_prefix_match_keeps_the_scan_off_the_common_path(self) -> None:
		"""One prefix match is enough; the unindexed pass reads the whole release."""
		service = LocationSearchService()
		with patch.object(service, "_query", wraps=service._query) as query:
			results = service.search("springfield")["results"]

		self.assertEqual(len(results), 2)
		self.assertEqual(query.call_count, 1)

	def test_a_city_is_found_by_a_name_it_is_known_by_locally(self) -> None:
		results = LocationSearchService().search("bangalore")["results"]

		self.assertEqual([row["name"] for row in results], ["Bengaluru"])

	def test_an_alias_match_is_ranked_against_name_matches_by_population(self) -> None:
		"""Someone typing "new" means the city of 8.8 million, not the one it was named after."""
		results = LocationSearchService().search("new")["results"]

		self.assertEqual(results[0]["name"], "New York City")

	def test_a_city_is_returned_once_however_many_of_its_names_match(self) -> None:
		results = LocationSearchService().search("ben")["results"]

		self.assertEqual([row["name"] for row in results], ["Bengaluru"])

	def test_an_alias_search_still_skips_the_unindexed_pass(self) -> None:
		service = LocationSearchService()
		with patch.object(service, "_query", wraps=service._query) as query:
			results = service.search("nueva")["results"]

		self.assertEqual([row["name"] for row in results], ["New York City"])
		# One indexed name query. The contained pass never runs, because the alias answered.
		self.assertEqual(query.call_count, 1)

	def test_rejects_short_and_unbounded_queries(self) -> None:
		service = LocationSearchService()
		with self.assertRaises(frappe.ValidationError):
			service.search("a")
		with self.assertRaises(frappe.ValidationError):
			service.search("a" * 81)

	def test_wildcards_in_a_query_match_nothing_by_themselves(self) -> None:
		"""A LIKE pattern typed by a visitor is data, not a query."""
		self.assertEqual(LocationSearchService().search("%%")["results"], [])
		self.assertEqual(LocationSearchService().search("_engaluru")["results"], [])

	def test_search_is_empty_without_an_active_release(self) -> None:
		self._purge()
		result = LocationSearchService().search("Bengaluru")

		self.assertEqual(result["results"], [])
		self.assertIsNone(result["source"])
