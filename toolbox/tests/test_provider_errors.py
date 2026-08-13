# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from unittest.mock import Mock, patch

from frappe.exceptions import ServiceUnavailableError
from frappe.tests import UnitTestCase

from toolbox.provider_errors import provider_unavailable


class FakeCache:
	"""Enough of the cache for the throttle, and nothing that outlives one test."""

	def __init__(self) -> None:
		self.values: dict[str, object] = {}

	def get_value(self, key, **kwargs):
		return self.values.get(key)

	def set_value(self, key, value, **kwargs):
		self.values[key] = value


class TestProviderErrors(UnitTestCase):
	def setUp(self) -> None:
		self.cache = FakeCache()
		self.log_error = Mock()
		self.patches = [
			patch("toolbox.provider_errors.frappe.cache", self.cache),
			patch("toolbox.provider_errors.frappe.log_error", self.log_error),
		]
		for started in self.patches:
			started.start()
		self.addCleanup(lambda: [stopped.stop() for stopped in self.patches])

	def test_records_the_cause_and_returns_the_visitor_message(self) -> None:
		try:
			raise TimeoutError("read timed out")
		except TimeoutError as cause:
			error = provider_unavailable("Try again later.", provider="MET Norway", cause=cause)

		self.assertIsInstance(error, ServiceUnavailableError)
		self.assertEqual(str(error), "Try again later.")
		self.log_error.assert_called_once()
		logged = self.log_error.call_args.kwargs
		self.assertIn("MET Norway", logged["title"])
		# The whole point: the message names what actually failed, which the 503 cannot.
		self.assertIn("read timed out", logged["message"])
		# The caller raises next, and an ordinary insert would go with the rollback.
		self.assertTrue(logged["defer_insert"])

	def test_records_one_outage_rather_than_one_request(self) -> None:
		for _ in range(5):
			provider_unavailable("Try again later.", provider="European Central Bank", cause=OSError("down"))

		self.log_error.assert_called_once()

	def test_keeps_providers_apart(self) -> None:
		provider_unavailable("Try again later.", provider="MET Norway", cause=OSError("down"))
		provider_unavailable("Try again later.", provider="European Central Bank", cause=OSError("down"))

		self.assertEqual(self.log_error.call_count, 2)

	def test_records_a_failure_that_carries_no_exception(self) -> None:
		provider_unavailable(
			"Try again later.",
			provider="European Central Bank",
			note="Answered 304 with nothing cached to reuse.",
		)

		self.assertIn("304", self.log_error.call_args.kwargs["message"])

	def test_a_cache_that_cannot_answer_does_not_become_a_second_failure(self) -> None:
		self.cache.get_value = Mock(side_effect=ConnectionError("no redis"))

		error = provider_unavailable("Try again later.", provider="MET Norway", cause=OSError("down"))

		self.assertIsInstance(error, ServiceUnavailableError)
		self.log_error.assert_called_once()

	def test_a_log_that_cannot_be_written_does_not_become_a_500(self) -> None:
		"""The visitor's answer must not depend on the record of why it failed."""
		self.log_error.side_effect = RuntimeError("no database")

		error = provider_unavailable("Try again later.", provider="MET Norway", cause=OSError("down"))

		self.assertIsInstance(error, ServiceUnavailableError)
		self.assertEqual(str(error), "Try again later.")
