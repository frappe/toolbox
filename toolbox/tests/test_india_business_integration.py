from pathlib import Path
from tempfile import TemporaryDirectory

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.india_business import search_ifsc, search_pin
from toolbox.india_business_data import ImportMetadata, import_csv


class TestIndiaBusinessImports(IntegrationTestCase):
	def test_pin_import_is_idempotent_and_failed_replacement_keeps_active_data(self) -> None:
		with TemporaryDirectory() as directory:
			valid_path = self._write(
				directory,
				"pin.csv",
				"pincode,officename,officetype,delivery,district,statename\n"
				"560001,Bangalore G.P.O.,HO,Delivery,Bengaluru,Karnataka\n"
				"560001,Bangalore G.P.O.,HO,Delivery,Bengaluru,Karnataka\n",
			)
			active = import_csv(str(valid_path), self._metadata("PIN", "2026-07"))
			repeated = import_csv(str(valid_path), self._metadata("PIN", "2026-07"))

			self.assertEqual(active["name"], repeated["name"])
			self.assertEqual(active["record_count"], 1)
			self.assertEqual(active["exclusion_count"], 1)
			self.assertEqual(search_pin("560001")["results"][0]["office_name"], "Bangalore G.P.O.")

			invalid_path = self._write(
				directory,
				"invalid-pin.csv",
				"pincode,officename,district,statename\nbad,Incomplete,Nowhere,Nowhere\n",
			)
			with self.assertRaisesRegex(ValueError, "no valid records"):
				import_csv(str(invalid_path), self._metadata("PIN", "2026-08"))
			with self.assertRaisesRegex(ValueError, "no valid records"):
				import_csv(str(invalid_path), self._metadata("PIN", "2026-08"))

			self.assertEqual(
				frappe.db.get_value("Toolbox Dataset Release", active["name"], "status"),
				"Active",
			)
			self.assertEqual(search_pin("560001")["state"], "ready")

	def test_complete_ifsc_import_activates_search_and_reports_exclusions(self) -> None:
		with TemporaryDirectory() as directory:
			path = self._write(
				directory,
				"ifsc.csv",
				"IFSC,BANK,BRANCH,ADDRESS,CITY,DISTRICT,STATE\n"
				"HDFC0000001,HDFC Bank,Fort,Fort Mumbai,Mumbai,Mumbai,Maharashtra\n"
				"HDFC0000002,,Missing Bank,Unknown,Mumbai,Mumbai,Maharashtra\n",
			)
			release = import_csv(str(path), self._metadata("IFSC", "v-test"))

			self.assertEqual(release["record_count"], 1)
			self.assertEqual(release["exclusion_count"], 1)
			self.assertEqual(search_ifsc("HDFC0000001")["results"][0]["branch"], "Fort")
			self.assertEqual(search_ifsc("Mumbai")["results"][0]["ifsc_code"], "HDFC0000001")

	@staticmethod
	def _write(directory: str, filename: str, content: str) -> Path:
		path = Path(directory) / filename
		path.write_text(content, encoding="utf-8")
		return path

	@staticmethod
	def _metadata(dataset_type: str, version: str) -> ImportMetadata:
		return ImportMetadata(
			dataset_type=dataset_type,
			source_name="Test source",
			source_url="https://example.com/data",
			license_name="Test license",
			license_url="https://example.com/license",
			attribution="Test attribution",
			version=version,
			source_updated_at="2026-08-01 00:00:00",
		)
