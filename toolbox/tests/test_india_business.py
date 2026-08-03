import hashlib
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from toolbox.india_business import _pin_prefixes, get_dataset_status, search_ifsc, search_pin
from toolbox.india_business_data import normalize_ifsc_row, normalize_pin_row, stage_rows


class TestIndiaBusinessData(UnitTestCase):
	def test_normalizes_complete_pin_rows_from_official_headers(self) -> None:
		row = normalize_pin_row({
			"pincode": "560001",
			"officename": "Bangalore G.P.O.",
			"officetype": "HO",
			"delivery": "Delivery",
			"district": "Bengaluru",
			"statename": "Karnataka",
		})

		self.assertEqual(row["pin_code"], "560001")
		self.assertEqual(row["office_name"], "Bangalore G.P.O.")
		self.assertIn("560001|bangalore g.p.o.", row["business_key"])

	def test_rejects_incomplete_or_malformed_pin_rows(self) -> None:
		self.assertIsNone(normalize_pin_row({"pincode": "56001", "officename": "Office"}))
		self.assertIsNone(normalize_pin_row({"pincode": "560001", "officename": "Office"}))

	def test_keeps_only_valid_in_india_coordinates(self) -> None:
		base = {"pincode": "560001", "officename": "GPO", "district": "Bengaluru", "statename": "Karnataka"}
		good = normalize_pin_row({**base, "latitude": "12.9716", "longitude": "77.5946"})
		self.assertEqual((good["latitude"], good["longitude"]), ("12.9716", "77.5946"))
		# Out of range, zero, non-numeric, and half-missing pairs are all dropped to empty.
		for bad in ({"latitude": "0", "longitude": "77.5"}, {"latitude": "88", "longitude": "77.5"},
			{"latitude": "x", "longitude": "77.5"}, {"latitude": "12.9", "longitude": ""}):
			row = normalize_pin_row({**base, **bad})
			self.assertEqual((row["latitude"], row["longitude"]), ("", ""))

	def test_normalizes_complete_ifsc_rows(self) -> None:
		row = normalize_ifsc_row({
			"IFSC": "hdfc0000001",
			"BANK": "HDFC Bank",
			"BRANCH": "Fort",
			"CITY": "Mumbai",
			"STATE": "Maharashtra",
		})

		self.assertEqual(row["ifsc_code"], "HDFC0000001")
		self.assertEqual(row["business_key"], "HDFC0000001")

	def test_excludes_ifsc_rows_with_missing_required_source_values(self) -> None:
		base = {"IFSC": "HDFC0000001", "BANK": "HDFC Bank", "BRANCH": "Fort", "CITY": "Mumbai", "STATE": "Maharashtra"}
		for field in ("BANK", "BRANCH", "CITY", "STATE"):
			with self.subTest(field=field):
				self.assertIsNone(normalize_ifsc_row({**base, field: ""}))

	def test_staging_is_deterministic_and_reports_duplicates_and_invalid_rows(self) -> None:
		rows = [
			{"pincode": "560001", "officename": "Bangalore G.P.O.", "district": "Bengaluru", "statename": "Karnataka"},
			{"pincode": "560001", "officename": "Bangalore G.P.O.", "district": "Bengaluru", "statename": "Karnataka"},
			{"pincode": "bad", "officename": "Bad", "district": "Bad", "statename": "Bad"},
		]

		with patch("toolbox.india_business_data._bulk_insert") as bulk_insert:
			result = stage_rows("PIN", rows, "pin:release")

		self.assertEqual(result, {"record_count": 1, "exclusion_count": 1, "duplicate_count": 1})
		inserted = bulk_insert.call_args.args[1][0]
		# name is the stable hash of the release-scoped key; the key is not stored.
		expected_key = "pin:release:560001|bangalore g.p.o.|bengaluru|karnataka"
		self.assertEqual(inserted["name"], hashlib.sha256(expected_key.encode()).hexdigest()[:40])
		self.assertNotIn("record_key", inserted)


class TestIndiaBusinessApi(UnitTestCase):
	def test_public_endpoints_are_guest_get_only(self) -> None:
		for endpoint in (get_dataset_status, search_pin, search_ifsc):
			with self.subTest(endpoint=endpoint.__name__):
				self.assertIn(endpoint, frappe.guest_methods)
				self.assertEqual(
					frappe.allowed_http_methods_for_whitelisted_func[endpoint],
					("GET", "QUERY"),
				)

	def test_search_rejects_short_and_unbounded_queries(self) -> None:
		for endpoint in (search_pin, search_ifsc):
			with self.subTest(endpoint=endpoint.__name__):
				with self.assertRaises(frappe.ValidationError):
					endpoint("a")
				with self.assertRaises(frappe.ValidationError):
					endpoint("a" * 81)

	def test_pin_prefixes_add_current_name_for_former_city_aliases(self) -> None:
		bangalore = _pin_prefixes("Bangalore")
		self.assertIn("Bangalore%", bangalore)
		self.assertIn("Bengaluru%", bangalore)
		self.assertEqual(_pin_prefixes("Pune"), ["Pune%"])
