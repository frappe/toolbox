from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from toolbox.hsn import get_dataset_status, search_hsn
from toolbox.hsn_data import HSN_DOCTYPE, import_hsn_jsonl, normalize_hsn_row, stage_rows
from toolbox.india_business_data import RELEASE_DOCTYPE

SAMPLE = (
	'{"code": "8517", "code_type": "HSN", "description": "Telephone sets"}\n'
	'{"code": "0101", "code_type": "HSN", "description": "Live horses"}\n'
	'{"code": "9954", "code_type": "SAC", "description": "Construction services"}\n'
)


class TestHsnData(UnitTestCase):
	def test_normalizes_goods_and_services_codes(self) -> None:
		goods = normalize_hsn_row({"code": "0101", "description": "Live horses"})
		self.assertEqual(goods["code_type"], "HSN")
		services = normalize_hsn_row({"code": "995411", "description": "Construction"})
		self.assertEqual(services["code_type"], "SAC")

	def test_rejects_non_numeric_or_empty_rows(self) -> None:
		self.assertIsNone(normalize_hsn_row({"code": "AB12", "description": "x"}))
		self.assertIsNone(normalize_hsn_row({"code": "1", "description": "too short"}))
		self.assertIsNone(normalize_hsn_row({"code": "0101", "description": ""}))

	def test_staging_deduplicates_by_code(self) -> None:
		lines = [
			'{"code": "0101", "description": "Live horses"}',
			'{"code": "0101", "description": "Live horses"}',
			'{"code": "bad", "description": "invalid"}',
		]
		with patch("toolbox.hsn_data._bulk_insert") as bulk_insert:
			result = stage_rows(lines, "release-1")
		self.assertEqual(result["record_count"], 1)
		self.assertEqual(result["duplicate_count"], 1)
		self.assertEqual(result["exclusion_count"], 1)
		bulk_insert.assert_called_once()


class TestHsnImport(IntegrationTestCase):
	def setUp(self) -> None:
		self._purge()

	def tearDown(self) -> None:
		self._purge()

	@staticmethod
	def _purge() -> None:
		frappe.db.rollback()
		frappe.db.delete(HSN_DOCTYPE)
		frappe.db.delete(RELEASE_DOCTYPE, {"dataset_type": "HSN"})
		frappe.db.commit()

	def _write(self, directory: str, content: str) -> str:
		path = Path(directory) / "hsn.jsonl"
		path.write_text(content, encoding="utf-8")
		return str(path)

	def test_import_activates_and_search_reads_the_dataset(self) -> None:
		with TemporaryDirectory() as directory:
			result = import_hsn_jsonl(self._write(directory, SAMPLE), "2024-06-25", "2024-06-25")

		self.assertEqual(result["status"], "Active")
		self.assertEqual(result["record_count"], 3)

		by_code = search_hsn("8517")
		self.assertEqual(by_code["results"][0]["code"], "8517")
		by_text = search_hsn("construction")
		self.assertEqual(by_text["results"][0]["code_type"], "SAC")

		status = get_dataset_status()["hsn"]
		self.assertEqual(status["version"], "2024-06-25")
		self.assertEqual(status["recordCount"], 3)

	def test_reimport_is_idempotent_and_new_version_supersedes(self) -> None:
		with TemporaryDirectory() as directory:
			first = import_hsn_jsonl(self._write(directory, SAMPLE), "2024-06-25", "2024-06-25")
			again = import_hsn_jsonl(self._write(directory, SAMPLE), "2024-06-25", "2024-06-25")
			self.assertEqual(first["name"], again["name"])

			newer = self._write(directory, SAMPLE + '{"code": "6109", "description": "T-shirts"}\n')
			import_hsn_jsonl(newer, "2025-01-01", "2025-01-01")

		self.assertEqual(get_dataset_status()["hsn"]["version"], "2025-01-01")
		self.assertEqual(search_hsn("6109")["results"][0]["description"], "T-shirts")

	def test_search_is_unavailable_without_an_active_release(self) -> None:
		self.assertEqual(search_hsn("8517")["state"], "unavailable")
		self.assertIsNone(get_dataset_status()["hsn"])
