import json
from pathlib import Path
from tempfile import TemporaryDirectory

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.dictionary import lookup, suggest
from toolbox.dictionary_data import (
	DATASET_TYPE,
	DICTIONARY_DOCTYPE,
	RELEASE_DOCTYPE,
	file_sha256,
	import_dictionary_jsonl,
)


class TestDictionaryImports(IntegrationTestCase):
	def setUp(self) -> None:
		self._purge_datasets()

	def tearDown(self) -> None:
		self._purge_datasets()

	@staticmethod
	def _purge_datasets() -> None:
		# A failed import commits its Failed marker, so it escapes the framework's
		# per-test rollback. Purge on both ends to isolate each test from committed
		# leftovers (its own and any prior import run). Only Dictionary rows are touched.
		frappe.db.rollback()
		frappe.db.delete(DICTIONARY_DOCTYPE)
		frappe.db.delete(RELEASE_DOCTYPE, {"dataset_type": DATASET_TYPE})
		frappe.db.commit()

	def test_import_is_idempotent_and_failed_replacement_keeps_active_data(self) -> None:
		with TemporaryDirectory() as directory:
			valid_path = self._write(directory, "dictionary.jsonl", [
				{"word": "Dog", "senses": [
					{"pos": "noun", "definition": "a domesticated carnivore", "examples": ["the dog barked"]},
					{"pos": "verb", "definition": "to follow persistently"},
				]},
				{"word": "dog", "senses": [{"pos": "noun", "definition": "duplicate"}]},
			])
			active = import_dictionary_jsonl(str(valid_path), "3.1", "2026-08-01 00:00:00")
			repeated = import_dictionary_jsonl(str(valid_path), "3.1", "2026-08-01 00:00:00")

			self.assertEqual(active["name"], repeated["name"])
			self.assertEqual(active["record_count"], 1)
			self.assertEqual(active["exclusion_count"], 0)
			self.assertEqual(active["duplicate_count"], 1)

			result = lookup("dog")
			self.assertEqual(result["state"], "ready")
			self.assertEqual(result["word"], "Dog")
			# Both senses of the single entry are returned together.
			self.assertEqual([sense["pos"] for sense in result["senses"]], ["noun", "verb"])
			self.assertEqual(result["source"]["name"], "Princeton University WordNet 3.1")

			empty_path = self._write(directory, "empty.jsonl", [
				{"word": "", "senses": [{"pos": "noun", "definition": "no word"}]},
			])
			with self.assertRaisesRegex(ValueError, "no valid records"):
				import_dictionary_jsonl(str(empty_path), "3.2", "2026-09-01 00:00:00")

			self.assertEqual(
				frappe.db.get_value(RELEASE_DOCTYPE, active["name"], "status"),
				"Active",
			)
			self.assertEqual(lookup("dog")["state"], "ready")

	def test_reimport_of_superseded_release_keeps_the_newer_active(self) -> None:
		with TemporaryDirectory() as directory:
			first = self._write(directory, "a.jsonl", [
				{"word": "dog", "senses": [{"pos": "noun", "definition": "canine"}]},
			])
			second = self._write(directory, "b.jsonl", [
				{"word": "cat", "senses": [{"pos": "noun", "definition": "feline"}]},
			])
			release_a = import_dictionary_jsonl(str(first), "3.1", "2026-06-01 00:00:00")
			release_b = import_dictionary_jsonl(str(second), "3.2", "2026-07-01 00:00:00")
			# Re-running the older import command must be a no-op, never a rollback.
			import_dictionary_jsonl(str(first), "3.1", "2026-06-01 00:00:00")

			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_a["name"], "status"), "Superseded")
			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_b["name"], "status"), "Active")
			self.assertEqual(lookup("cat")["state"], "ready")
			self.assertEqual(lookup("dog")["state"], "missing")

	def test_activation_prunes_all_but_the_previous_release_rows(self) -> None:
		with TemporaryDirectory() as directory:
			releases = []
			for index, word in enumerate(("dog", "cat", "fox")):
				path = self._write(directory, f"gen-{index}.jsonl", [
					{"word": word, "senses": [{"pos": "noun", "definition": f"sense {index}"}]},
				])
				releases.append(import_dictionary_jsonl(str(path), f"3.{index}", f"2026-0{index + 1}-01 00:00:00"))

			oldest, previous, current = releases
			self.assertEqual(frappe.db.count(DICTIONARY_DOCTYPE, {"dataset_release": oldest["name"]}), 0)
			self.assertEqual(frappe.db.count(DICTIONARY_DOCTYPE, {"dataset_release": previous["name"]}), 1)
			self.assertEqual(frappe.db.count(DICTIONARY_DOCTYPE, {"dataset_release": current["name"]}), 1)
			# Metadata rows are retained for every release, only bulky records are pruned.
			self.assertEqual(frappe.db.count(RELEASE_DOCTYPE, {"dataset_type": DATASET_TYPE}), 3)

	def test_failed_import_records_a_durable_failure_status(self) -> None:
		with TemporaryDirectory() as directory:
			path = self._write(directory, "broken.jsonl", [
				{"word": "dog"},
				{"senses": [{"pos": "noun"}]},
			])
			with self.assertRaisesRegex(ValueError, "no valid records"):
				import_dictionary_jsonl(str(path), "3.1", "2026-10-01 00:00:00")

			release_key = f"dictionary:{file_sha256(Path(path))}"
			# Prove the marker survives the rollback the failing caller performs.
			frappe.db.rollback()
			self.assertEqual(frappe.db.get_value(RELEASE_DOCTYPE, release_key, "status"), "Failed")

	def test_missing_word_returns_deterministic_near_suggestions(self) -> None:
		with TemporaryDirectory() as directory:
			path = self._write(directory, "words.jsonl", [
				{"word": word, "senses": [{"pos": "noun", "definition": word}]}
				for word in ("dog", "dogs", "dogma", "cat")
			])
			import_dictionary_jsonl(str(path), "3.1", "2026-08-01 00:00:00")

			missing = lookup("doggo")
			self.assertEqual(missing["state"], "missing")
			self.assertEqual(missing["word"], "doggo")
			# Trimming "doggo" reaches the "dog" family; "cat" shares no prefix.
			self.assertIn("dog", missing["suggestions"])
			self.assertNotIn("cat", missing["suggestions"])

			# suggest() is deterministic across repeated calls over the same release.
			self.assertEqual(suggest("dog")["suggestions"], suggest("dog")["suggestions"])
			self.assertEqual(suggest("dog")["suggestions"][:3], ["dog", "dogs", "dogma"])

	@staticmethod
	def _write(directory: str, filename: str, rows: list[dict]) -> Path:
		path = Path(directory) / filename
		path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
		return path
