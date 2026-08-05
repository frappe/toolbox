# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import unittest
from unittest.mock import patch

from toolbox.expense_fx import cross_rate, suggest_conversion_rate

RATES = {"USD": 1.08, "INR": 90.0, "GBP": 0.85}


class TestCrossRate(unittest.TestCase):
	def test_from_eur_base(self):
		self.assertAlmostEqual(cross_rate(RATES, "EUR", "EUR", "USD"), 1.08)

	def test_to_eur_base(self):
		self.assertAlmostEqual(cross_rate(RATES, "EUR", "USD", "EUR"), 1 / 1.08)

	def test_between_two_non_base_currencies(self):
		self.assertAlmostEqual(cross_rate(RATES, "EUR", "USD", "INR"), 90.0 / 1.08)

	def test_same_currency_is_one(self):
		self.assertEqual(cross_rate(RATES, "EUR", "USD", "USD"), 1.0)

	def test_unknown_currency_returns_none(self):
		self.assertIsNone(cross_rate(RATES, "EUR", "USD", "JPY"))
		self.assertIsNone(cross_rate(RATES, "EUR", "ZZZ", "USD"))


class _FakeService:
	def get(self):
		return {"baseCurrency": "EUR", "rateDate": "2026-08-01", "rates": RATES}


class TestSuggestConversionRate(unittest.TestCase):
	def test_suggests_a_cross_rate(self):
		with patch("toolbox.currency.CurrencyRateService", _FakeService):
			result = suggest_conversion_rate("USD", "INR")
		self.assertTrue(result["ok"])
		self.assertAlmostEqual(result["rate"], round(90.0 / 1.08, 6))
		self.assertEqual(result["date"], "2026-08-01")
		self.assertEqual(result["source"], "ecb-reference")

	def test_same_currency(self):
		result = suggest_conversion_rate("INR", "INR")
		self.assertTrue(result["ok"])
		self.assertEqual(result["rate"], 1.0)

	def test_unknown_pair(self):
		with patch("toolbox.currency.CurrencyRateService", _FakeService):
			result = suggest_conversion_rate("USD", "JPY")
		self.assertFalse(result["ok"])
		self.assertIn("JPY", result["error"])

	def test_service_unavailable(self):
		class _Broken:
			def get(self):
				raise RuntimeError("down")

		with patch("toolbox.currency.CurrencyRateService", _Broken):
			result = suggest_conversion_rate("USD", "INR")
		self.assertFalse(result["ok"])
