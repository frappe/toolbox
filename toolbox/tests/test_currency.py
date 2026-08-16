# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from contextlib import nullcontext
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import frappe
import requests
from frappe.exceptions import ServiceUnavailableError
from frappe.tests import UnitTestCase
from redis.exceptions import LockError

from toolbox.currency import CurrencyRateService, get_reference_rates
from toolbox.currency_provider import (
	CurrencyProviderError,
	EcbReferenceRateProvider,
	parse_ecb_reference_rates,
)

NOW = datetime(2026, 8, 1, 0, 0, tzinfo=UTC)
RATES = {
	"schemaVersion": 1,
	"baseCurrency": "EUR",
	"rateDate": "2026-07-31",
	"rates": {"EUR": 1.0, "GBP": 0.85, "INR": 100.0, "SGD": 1.5, "USD": 1.1},
	"source": {"name": "European Central Bank", "url": "https://example.com", "attribution": "Source: ECB statistics."},
}


class FakeCache:
	def __init__(self) -> None:
		self.value = None
		self.set_calls = 0
		self.lock_calls = 0

	def get_value(self, *_args: object, **_kwargs: object) -> dict[str, object] | None:
		return self.value

	def set_value(self, _key: str, value: dict[str, object], **_kwargs: object) -> None:
		self.value = value
		self.set_calls += 1

	def lock(self, *_args: object, **_kwargs: object) -> nullcontext:
		self.lock_calls += 1
		return nullcontext()


class TestCurrencyProvider(UnitTestCase):
	def test_parses_and_validates_ecb_xml(self) -> None:
		parsed = parse_ecb_reference_rates(self._xml())

		self.assertEqual(parsed["rateDate"], "2026-07-31")
		self.assertEqual(parsed["baseCurrency"], "EUR")
		self.assertEqual(parsed["rates"]["INR"], 100.0)
		self.assertEqual(parsed["source"]["name"], "European Central Bank")

	def test_rejects_invalid_and_incomplete_provider_data(self) -> None:
		for content in (b"not xml", b"<root><Cube time='bad'/></root>", b"<root/>"):
			with self.subTest(content=content):
				self.assertRaises(CurrencyProviderError, parse_ecb_reference_rates, content)

	def test_uses_conditional_headers_and_handles_not_modified(self) -> None:
		response = Mock(status_code=304, content=b"", headers={})
		session = Mock()
		session.get.return_value = response
		provider = EcbReferenceRateProvider(session)

		result = provider.fetch({"etag": '"rates"', "lastModified": "yesterday"})

		self.assertTrue(result["notModified"])
		headers = session.get.call_args.kwargs["headers"]
		self.assertEqual(headers["If-None-Match"], '"rates"')
		self.assertEqual(headers["If-Modified-Since"], "yesterday")

	def test_wraps_network_failures(self) -> None:
		session = Mock()
		session.get.side_effect = requests.RequestException("offline")
		self.assertRaises(CurrencyProviderError, EcbReferenceRateProvider(session).fetch)

	@staticmethod
	def _xml() -> bytes:
		currencies = ["USD", "JPY", "CZK", "DKK", "GBP", "HUF", "PLN", "RON", "SEK", "CHF", "ISK", "NOK", "TRY", "AUD", "BRL", "CAD", "CNY", "HKD", "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR"]
		rows = "".join(f'<Cube currency="{code}" rate="{100 if code == "INR" else index + 1}"/>' for index, code in enumerate(currencies))
		return f'<Envelope><Cube><Cube time="2026-07-31">{rows}</Cube></Cube></Envelope>'.encode()


class TestCurrencyRateService(UnitTestCase):
	def test_fetches_once_then_uses_shared_cache(self) -> None:
		cache = FakeCache()
		provider = Mock()
		provider.fetch.return_value = {"notModified": False, "data": RATES, "validators": {"etag": '"rates"'}}
		service = CurrencyRateService(provider=provider, cache=cache, clock=lambda: NOW)

		self.assertEqual(service.get()["cacheStatus"], "live")
		self.assertEqual(service.get()["cacheStatus"], "cached")
		provider.fetch.assert_called_once_with(None)
		self.assertEqual(cache.lock_calls, 1)

	def test_revalidates_expired_cache_without_replacing_rates(self) -> None:
		cache = FakeCache()
		cache.value = self._cached(NOW - timedelta(hours=7))
		provider = Mock()
		provider.fetch.return_value = {"notModified": True, "validators": {"etag": '"rates"'}}

		response = CurrencyRateService(provider=provider, cache=cache, clock=lambda: NOW).get()

		self.assertEqual(response["cacheStatus"], "cached")
		self.assertEqual(response["rates"], RATES["rates"])
		self.assertEqual(response["providerCheckedAt"], NOW.isoformat())

	def test_returns_honestly_labeled_stale_cache_after_failure(self) -> None:
		cache = FakeCache()
		cache.value = self._cached(NOW - timedelta(days=2))
		provider = Mock()
		provider.fetch.side_effect = CurrencyProviderError("failed")

		response = CurrencyRateService(provider=provider, cache=cache, clock=lambda: NOW).get()

		self.assertEqual(response["cacheStatus"], "stale")
		self.assertEqual(response["rateDate"], "2026-07-31")

	def test_fails_cleanly_without_any_cached_rates(self) -> None:
		provider = Mock()
		provider.fetch.side_effect = CurrencyProviderError("failed")
		with self.assertRaises(ServiceUnavailableError):
			CurrencyRateService(provider=provider, cache=FakeCache(), clock=lambda: NOW).get()

	def test_records_why_the_rates_failed(self) -> None:
		"""A 503 alone cannot say whether the ECB is down or this host has no network."""
		provider = Mock()
		provider.fetch.side_effect = CurrencyProviderError("the ECB feed is unavailable")

		with patch("toolbox.provider_errors.frappe.log_error") as log_error, patch(
			"toolbox.provider_errors.frappe.cache", FakeCache()
		), self.assertRaises(ServiceUnavailableError):
			CurrencyRateService(provider=provider, cache=FakeCache(), clock=lambda: NOW).get()

		self.assertIn("European Central Bank", log_error.call_args.kwargs["title"])
		self.assertIn("the ECB feed is unavailable", log_error.call_args.kwargs["message"])

	def test_records_a_conditional_request_that_has_nothing_to_reuse(self) -> None:
		"""304 with no cached table is a contradiction, and the only sign of it was a 503."""
		provider = Mock()
		provider.fetch.return_value = {"notModified": True, "validators": {"etag": '"rates"'}}

		with patch("toolbox.provider_errors.frappe.log_error") as log_error, patch(
			"toolbox.provider_errors.frappe.cache", FakeCache()
		), self.assertRaises(ServiceUnavailableError):
			CurrencyRateService(provider=provider, cache=FakeCache(), clock=lambda: NOW).get()

		self.assertIn("304", log_error.call_args.kwargs["message"])

	def test_returns_stale_cache_when_another_refresh_holds_the_lock(self) -> None:
		cache = FakeCache()
		cache.value = self._cached(NOW - timedelta(days=1))
		cache.lock = Mock(side_effect=LockError("busy"))

		response = CurrencyRateService(provider=Mock(), cache=cache, clock=lambda: NOW).get()

		self.assertEqual(response["cacheStatus"], "stale")

	def test_public_endpoint_is_guest_get_only(self) -> None:
		self.assertIn(get_reference_rates, frappe.whitelisted)
		self.assertIn(get_reference_rates, frappe.guest_methods)
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[get_reference_rates], ("GET", "QUERY")
		)

	@staticmethod
	def _cached(checked_at: datetime) -> dict[str, object]:
		return {**RATES, "providerCheckedAt": checked_at.isoformat(), "validators": {"etag": '"rates"'}}
