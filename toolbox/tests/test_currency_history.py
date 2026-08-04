# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from contextlib import nullcontext
from datetime import datetime, timezone
from unittest.mock import Mock

import requests
from frappe.exceptions import ServiceUnavailableError
from frappe.tests import UnitTestCase

from toolbox.currency_history import (
	CurrencyHistoryError,
	CurrencyHistoryService,
	EcbHistoricalRateProvider,
	_cross_rate_series,
	_downsample,
	parse_ecb_history_csv,
)

NOW = datetime(2026, 8, 4, 0, 0, tzinfo=timezone.utc)

CSV_HEADER = "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS"


def _csv(*rows: tuple[str, str, str]) -> str:
	lines = [CSV_HEADER]
	for currency, day, value in rows:
		lines.append(f"EXR.D.{currency}.EUR.SP00.A,D,{currency},EUR,SP00,A,{day},{value},A")
	return "\n".join(lines)


class FakeCache:
	def __init__(self) -> None:
		self.store: dict[str, object] = {}

	def get_value(self, key: str, *_args: object, **_kwargs: object) -> object | None:
		return self.store.get(key)

	def set_value(self, key: str, value: object, **_kwargs: object) -> None:
		self.store[key] = value

	def lock(self, *_args: object, **_kwargs: object) -> nullcontext:
		return nullcontext()


class TestEcbHistoryParsing(UnitTestCase):
	def test_parses_requested_currencies_and_skips_others(self) -> None:
		text = _csv(
			("USD", "2026-07-30", "1.1476"),
			("INR", "2026-07-30", "109.808"),
			("JPY", "2026-07-30", "170.5"),  # not requested -> ignored
			("USD", "bad-date", "1.1"),  # malformed date -> skipped
			("USD", "2026-07-31", "-2"),  # invalid rate -> skipped
		)
		observations = parse_ecb_history_csv(text, {"USD", "INR"})

		self.assertEqual(observations["USD"], {"2026-07-30": 1.1476})
		self.assertEqual(observations["INR"], {"2026-07-30": 109.808})
		self.assertNotIn("JPY", observations)

	def test_rejects_response_without_columns(self) -> None:
		self.assertRaises(CurrencyHistoryError, parse_ecb_history_csv, "a,b,c\n1,2,3", {"USD"})


class TestCrossRateSeries(UnitTestCase):
	def test_cross_rate_uses_intersecting_dates(self) -> None:
		observations = {
			"USD": {"2026-07-30": 1.1476, "2026-07-31": 1.1485, "2026-08-03": 1.1535},
			"INR": {"2026-07-30": 109.808, "2026-07-31": 109.5495},  # missing 08-03
		}
		points = _cross_rate_series("USD", "INR", observations)

		self.assertEqual([point["date"] for point in points], ["2026-07-30", "2026-07-31"])
		# 1 USD -> INR = INR_per_EUR / USD_per_EUR.
		self.assertAlmostEqual(points[0]["value"], 109.808 / 1.1476, places=6)

	def test_euro_base_returns_quote_per_euro_directly(self) -> None:
		observations = {"USD": {"2026-07-30": 1.1476}}
		points = _cross_rate_series("EUR", "USD", observations)
		self.assertEqual(points, [{"date": "2026-07-30", "value": 1.1476}])

	def test_euro_quote_inverts_the_base_rate(self) -> None:
		observations = {"USD": {"2026-07-30": 1.25}}
		points = _cross_rate_series("USD", "EUR", observations)
		self.assertEqual(points, [{"date": "2026-07-30", "value": 0.8}])


class TestDownsample(UnitTestCase):
	def test_keeps_first_and_last_and_bounds_length(self) -> None:
		points = [{"date": str(index), "value": index} for index in range(1000)]
		reduced = _downsample(points, 100)

		self.assertLessEqual(len(reduced), 101)
		self.assertEqual(reduced[0], points[0])
		self.assertEqual(reduced[-1], points[-1])

	def test_returns_input_when_already_small(self) -> None:
		points = [{"date": "1", "value": 1}, {"date": "2", "value": 2}]
		self.assertIs(_downsample(points, 500), points)


class TestCurrencyHistoryService(UnitTestCase):
	def _service(self, observations: dict[str, dict[str, float]]) -> CurrencyHistoryService:
		provider = Mock()
		provider.fetch.return_value = observations
		return CurrencyHistoryService(provider=provider, cache=FakeCache(), clock=lambda: NOW)

	def test_builds_and_caches_a_series(self) -> None:
		service = self._service(
			{
				"USD": {"2026-07-30": 1.1476, "2026-07-31": 1.1485},
				"INR": {"2026-07-30": 109.808, "2026-07-31": 109.5495},
			}
		)
		response = service.get("USD", "INR", "1Y")

		self.assertEqual(response["base"], "USD")
		self.assertEqual(response["quote"], "INR")
		self.assertEqual(len(response["points"]), 2)
		self.assertEqual(response["source"]["name"], "European Central Bank")
		# Second call is served from cache without re-fetching.
		service.provider.fetch.reset_mock()
		service.get("USD", "INR", "1Y")
		service.provider.fetch.assert_not_called()

	def test_only_fetches_non_euro_currencies(self) -> None:
		service = self._service({"USD": {"2026-07-30": 1.1476, "2026-07-31": 1.1485}})
		service.get("EUR", "USD", "1M")
		service.provider.fetch.assert_called_once()
		self.assertEqual(service.provider.fetch.call_args.args[0], ["USD"])

	def test_rejects_unsupported_currency_and_range(self) -> None:
		service = self._service({})
		self.assertRaises(CurrencyHistoryError, service.get, "USD", "ZZZ", "1Y")
		self.assertRaises(CurrencyHistoryError, service.get, "USD", "INR", "10Y")

	def test_maps_provider_failure_to_service_unavailable(self) -> None:
		provider = Mock()
		provider.fetch.side_effect = CurrencyHistoryError("down")
		service = CurrencyHistoryService(provider=provider, cache=FakeCache(), clock=lambda: NOW)
		self.assertRaises(ServiceUnavailableError, service.get, "USD", "INR", "1Y")


class TestEcbHistoricalRateProvider(UnitTestCase):
	def test_fetch_parses_a_csv_response(self) -> None:
		response = Mock(status_code=200)
		response.content = b"x" * 100
		response.text = _csv(("USD", "2026-07-30", "1.1476"))
		session = Mock()
		session.get.return_value = response

		provider = EcbHistoricalRateProvider(session=session)
		observations = provider.fetch(["USD"], NOW.date())
		self.assertEqual(observations["USD"], {"2026-07-30": 1.1476})

	def test_fetch_raises_on_transport_error(self) -> None:
		session = Mock()
		session.get.side_effect = requests.RequestException("boom")
		provider = EcbHistoricalRateProvider(session=session)
		self.assertRaises(CurrencyHistoryError, provider.fetch, ["USD"], NOW.date())
