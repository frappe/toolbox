# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from unittest.mock import patch

from frappe.tests import UnitTestCase

from toolbox import data_sources


class TestDataSources(UnitTestCase):
	"""One answer describing every dataset the site serves."""

	def test_every_dataset_is_reported_in_a_fixed_order(self):
		"""A page listing four datasets where five are expected says nothing about which is missing."""
		payload = data_sources.get_data_sources()

		self.assertEqual(
			[dataset["datasetType"] for dataset in payload["datasets"]],
			list(data_sources.DATASET_TYPES),
		)
		self.assertEqual(payload["schemaVersion"], 1)

	def test_an_active_release_carries_its_facts_and_its_licence(self):
		payload = data_sources.get_data_sources()

		for dataset in payload["datasets"]:
			if not dataset["active"]:
				continue
			with self.subTest(dataset=dataset["datasetType"]):
				self.assertTrue(dataset["version"])
				self.assertGreater(dataset["recordCount"], 0)
				self.assertTrue(dataset["source"]["name"])
				self.assertTrue(dataset["source"]["license"])
				self.assertTrue(dataset["source"]["url"])

	def test_a_dataset_with_no_active_release_says_so(self):
		"""The page states it rather than dropping the row, which would read as though it were fine."""
		with patch.object(data_sources, "_active_releases", return_value=[]):
			payload = data_sources.get_data_sources()

		self.assertEqual(len(payload["datasets"]), len(data_sources.DATASET_TYPES))
		for dataset in payload["datasets"]:
			self.assertFalse(dataset["active"])
			self.assertNotIn("recordCount", dataset)

	def test_it_reads_the_ledger_once(self):
		"""Five queries for five datasets is the shape this endpoint exists to avoid."""
		with patch.object(data_sources, "_active_releases", return_value=[]) as ledger:
			data_sources.get_data_sources()

		ledger.assert_called_once()
