from pathlib import Path
from tempfile import TemporaryDirectory

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.india_business import search_ifsc, search_pin
from toolbox.india_business_data import (
	IFSC_DOCTYPE,
	PIN_DOCTYPE,
	RELEASE_DOCTYPE,
	ImportMetadata,
	file_sha256,
	import_csv,
)


class TestIndiaBusinessImports(IntegrationTestCase):
	def setUp(self) -> None:
		self._purge_datasets()

	def tearDown(self) -> None:
		self._purge_datasets()

	@staticmethod
	def _purge_datasets() -> None:
		# A failed import commits its Failed marker, so it escapes the framework's
		# per-test rollback. Purge on both ends to isolate each test from committed
		# leftovers (its own and any prior import run).
		frappe.db.rollback()
		for doctype in (PIN_DOCTYPE, IFSC_DOCTYPE, RELEASE_DOCTYPE):
			frappe.db.delete(doctype)
		frappe.db.commit()

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
			self.assertEqual(active["exclusion_count"], 0)
			self.assertEqual(active["duplicate_count"], 1)
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
			self.assertEqual(release["duplicate_count"], 0)
			self.assertEqual(search_ifsc("HDFC0000001")["results"][0]["branch"], "Fort")
			self.assertEqual(search_ifsc("Mumbai")["results"][0]["ifsc_code"], "HDFC0000001")

	def test_reimport_of_superseded_release_keeps_the_newer_active(self) -> None:
		with TemporaryDirectory() as directory:
			first = self._write(
				directory,
				"pin-a.csv",
				"pincode,officename,officetype,delivery,district,statename\n"
				"560001,Bangalore G.P.O.,HO,Delivery,Bengaluru,Karnataka\n",
			)
			second = self._write(
				directory,
				"pin-b.csv",
				"pincode,officename,officetype,delivery,district,statename\n"
				"110001,New Delhi G.P.O.,HO,Delivery,New Delhi,Delhi\n",
			)
			release_a = import_csv(str(first), self._metadata("PIN", "2026-06"))
			release_b = import_csv(str(second), self._metadata("PIN", "2026-07"))
			# Re-running the older import command must be a no-op, never a rollback.
			import_csv(str(first), self._metadata("PIN", "2026-06"))

			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_a["name"], "status"), "Superseded")
			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_b["name"], "status"), "Active")
			self.assertEqual(search_pin("110001")["results"][0]["office_name"], "New Delhi G.P.O.")

	def test_activation_prunes_all_but_the_previous_release_rows(self) -> None:
		with TemporaryDirectory() as directory:
			releases = []
			for index, pin in enumerate(("560001", "110001", "700001")):
				path = self._write(
					directory,
					f"pin-{index}.csv",
					"pincode,officename,officetype,delivery,district,statename\n"
					f"{pin},Office {index},HO,Delivery,District {index},State {index}\n",
				)
				releases.append(import_csv(str(path), self._metadata("PIN", f"2026-0{index + 1}")))

			oldest, previous, current = releases
			self.assertEqual(frappe.db.count(PIN_DOCTYPE, {"dataset_release": oldest["name"]}), 0)
			self.assertEqual(frappe.db.count(PIN_DOCTYPE, {"dataset_release": previous["name"]}), 1)
			self.assertEqual(frappe.db.count(PIN_DOCTYPE, {"dataset_release": current["name"]}), 1)
			# Metadata rows are retained for every release, only bulky records are pruned.
			self.assertEqual(frappe.db.count(RELEASE_DOCTYPE, {"dataset_type": "PIN"}), 3)

	def test_import_counts_duplicates_and_exclusions_separately(self) -> None:
		with TemporaryDirectory() as directory:
			path = self._write(
				directory,
				"pin-mixed.csv",
				"pincode,officename,officetype,delivery,district,statename\n"
				"560001,Bangalore G.P.O.,HO,Delivery,Bengaluru,Karnataka\n"
				"560001,Bangalore G.P.O.,HO,Delivery,Bengaluru,Karnataka\n"
				"000,Broken,HO,Delivery,Nowhere,Nowhere\n",
			)
			release = import_csv(str(path), self._metadata("PIN", "2026-09"))

			self.assertEqual(release["record_count"], 1)
			self.assertEqual(release["duplicate_count"], 1)
			self.assertEqual(release["exclusion_count"], 1)

	def test_failed_import_records_a_durable_failure_status(self) -> None:
		with TemporaryDirectory() as directory:
			path = self._write(
				directory,
				"pin-empty.csv",
				"pincode,officename,district,statename\nbad,Incomplete,Nowhere,Nowhere\n",
			)
			with self.assertRaisesRegex(ValueError, "no valid records"):
				import_csv(str(path), self._metadata("PIN", "2026-10"))

			release_key = f"pin:{file_sha256(Path(path))}"
			# Prove the marker survives the rollback the failing caller performs.
			frappe.db.rollback()
			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_key, "status"), "Failed")

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
