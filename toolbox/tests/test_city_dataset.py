from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from toolbox.city_data import CITY_DOCTYPE, import_city_jsonl, normalize_city_row, search_name, stage_rows
from toolbox.india_business_data import RELEASE_DOCTYPE
from toolbox.weather import LocationSearchService

SAMPLE = (
	'{"id": 1277333, "name": "Bengaluru", "country": "India", "country_code": "IN", "admin1": "Karnataka",'
	' "latitude": 12.97194, "longitude": 77.59369, "timezone": "Asia/Kolkata", "population": 8495492}\n'
	'{"id": 2657896, "name": "Z\\u00fcrich", "country": "Switzerland", "country_code": "CH", "admin1": "Zurich",'
	' "latitude": 47.36667, "longitude": 8.55, "timezone": "Europe/Zurich", "population": 415367}\n'
	'{"id": 4409896, "name": "Springfield", "country": "United States", "country_code": "US", "admin1": "Missouri",'
	' "latitude": 37.21533, "longitude": -93.29824, "timezone": "America/Chicago", "population": 170188}\n'
	'{"id": 4250542, "name": "Springfield", "country": "United States", "country_code": "US", "admin1": "Illinois",'
	' "latitude": 39.80172, "longitude": -89.64371, "timezone": "America/Chicago", "population": 114394}\n'
	'{"id": 5128581, "name": "New York City", "country": "United States", "country_code": "US", "admin1": "New York",'
	' "latitude": 40.71427, "longitude": -74.00597, "timezone": "America/New_York", "population": 8804190}\n'
)


class TestCityData(UnitTestCase):
	def test_folds_accents_and_case_for_search(self) -> None:
		self.assertEqual(search_name("Zürich"), "zurich")
		self.assertEqual(search_name("São Paulo"), "sao paulo")
		self.assertEqual(search_name("  MÁLAGA  "), "malaga")

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
			'{"id": 1, "name": "A", "latitude": 1, "longitude": 1}',
			'{"id": 1, "name": "A", "latitude": 1, "longitude": 1}',
			'{"id": 2, "name": "", "latitude": 1, "longitude": 1}',
			"not json",
		]
		with patch("toolbox.city_data._bulk_insert") as bulk_insert:
			result = stage_rows(lines, "release-1")
		self.assertEqual(result["record_count"], 1)
		self.assertEqual(result["duplicate_count"], 1)
		self.assertEqual(result["exclusion_count"], 2)
		bulk_insert.assert_called_once()


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
		frappe.db.delete(CITY_DOCTYPE)
		frappe.db.delete(RELEASE_DOCTYPE, {"dataset_type": "City"})
		frappe.db.commit()

	def test_import_activates_the_release(self) -> None:
		self.assertEqual(self.release["status"], "Active")
		self.assertEqual(self.release["record_count"], 5)

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
