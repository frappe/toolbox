# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from contextlib import contextmanager
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from toolbox import dictionary_data, hsn_data, india_business_data
from toolbox.dataset_lock import LOCK_TIMEOUT, dataset_import_lock

IMPORT_MODULES = (dictionary_data, hsn_data, india_business_data)


@contextmanager
def recorded_lock(events, key, timeout=None):
	"""Stand in for the advisory lock and record when it is taken and given back."""
	events.append(("acquire", key, timeout))
	try:
		yield
	finally:
		events.append(("release", key, None))


class TestDatasetImportLock(UnitTestCase):
	"""An importer holds its lock until its rows are committed.

	A lock released before the commit leaves the rows uncommitted and still holding their row
	locks, so a second import takes the lock, believes it is alone, and blocks on them.
	"""

	def run_lock(self, body):
		events = []

		def fake_lock(key, timeout=None):
			return recorded_lock(events, key, timeout)

		with patch.object(frappe.db, "advisory_lock", side_effect=fake_lock):
			with patch.object(frappe.db, "commit", side_effect=lambda: events.append(("commit", None, None))):
				body(events)
		return [event[0] for event in events]

	def test_the_commit_happens_before_the_lock_is_released(self):
		def body(events):
			with dataset_import_lock("toolbox:test-dataset-import"):
				events.append(("work", None, None))

		self.assertEqual(self.run_lock(body), ["acquire", "work", "commit", "release"])

	def test_a_failing_import_commits_nothing_here(self):
		"""The importer records its own failure and commits that. This adds no second commit."""

		def body(events):
			with self.assertRaises(ValueError):
				with dataset_import_lock("toolbox:test-dataset-import"):
					raise ValueError("the dataset contains no valid records")

		self.assertEqual(self.run_lock(body), ["acquire", "release"])

	def test_the_lock_carries_a_timeout(self):
		"""Without one, a second import waits forever rather than reporting that it cannot run."""
		captured = []

		@contextmanager
		def fake_lock(key, timeout=None):
			captured.append(timeout)
			yield

		with patch.object(frappe.db, "advisory_lock", side_effect=fake_lock):
			with patch.object(frappe.db, "commit"):
				with dataset_import_lock("toolbox:test-dataset-import"):
					pass

		self.assertEqual(captured, [LOCK_TIMEOUT])


class TestEveryImporterTakesTheLock(UnitTestCase):
	"""Five importers, one rule. A new one that takes the raw lock is the regression."""

	def test_no_importer_holds_the_raw_advisory_lock(self):
		for module in IMPORT_MODULES:
			with self.subTest(module=module.__name__):
				source = frappe.read_file(module.__file__)
				self.assertNotIn("frappe.db.advisory_lock", source)
				self.assertIn("dataset_import_lock", source)
