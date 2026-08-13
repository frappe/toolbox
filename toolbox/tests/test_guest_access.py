# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import UnitTestCase

from toolbox import currency, currency_history, data_sources, dictionary, hsn, india_business

# Every endpoint a visitor's browser calls. Toolbox has no accounts, so each one has to answer a
# Guest, and each one has to stay a read.
PUBLIC_ENDPOINTS = (
	currency.get_reference_rates,
	currency_history.get_rate_history,
	data_sources.get_data_sources,
	dictionary.get_dataset_status,
	dictionary.lookup,
	dictionary.suggest,
	hsn.get_dataset_status,
	hsn.search_hsn,
	india_business.get_dataset_status,
	india_business.search_pin,
	india_business.search_ifsc,
)


class TestGuestAccess(UnitTestCase):
	def test_every_public_endpoint_answers_a_guest(self):
		for endpoint in PUBLIC_ENDPOINTS:
			with self.subTest(endpoint=endpoint.__name__):
				self.assertIn(endpoint, frappe.guest_methods)

	def test_no_public_endpoint_accepts_a_write(self):
		"""Read-only keeps these off the write path a guest POST would open.

		Frappe expands ``methods=["GET"]`` to ``("GET", "QUERY")``. QUERY is a read verb, so the
		check is that no write verb is allowed rather than that the tuple is exactly ``GET``.
		"""
		writes = {"POST", "PUT", "PATCH", "DELETE"}
		for endpoint in PUBLIC_ENDPOINTS:
			with self.subTest(endpoint=endpoint.__name__):
				allowed = set(frappe.allowed_http_methods_for_whitelisted_func.get(endpoint) or ())
				self.assertTrue(allowed)
				self.assertFalse(allowed & writes)

	def test_no_other_toolbox_method_is_guest_reachable(self):
		"""A new whitelisted method must not reach the public by accident."""
		guest_reachable = {
			f"{fn.__module__}.{fn.__name__}"
			for fn in frappe.guest_methods
			if fn.__module__.startswith("toolbox.")
		}
		expected = {f"{fn.__module__}.{fn.__name__}" for fn in PUBLIC_ENDPOINTS}

		self.assertEqual(guest_reachable, expected)
