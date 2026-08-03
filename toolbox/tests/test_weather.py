# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import json
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import frappe
import requests
from frappe.exceptions import ServiceUnavailableError
from frappe.tests import UnitTestCase
from redis.exceptions import LockError

from toolbox.weather import (
	FORECAST_NOTICE,
	LocationSearchService,
	WeatherForecastService,
	get_forecast,
	search_locations,
)
from toolbox.weather_provider import (
	MAX_RESPONSE_BYTES,
	OpenMeteoProvider,
	WeatherProviderError,
	parse_forecast,
	parse_geocoding,
)

NOW = datetime(2026, 8, 3, 12, 0, tzinfo=timezone.utc)

FORECAST_RESPONSE = {
	"latitude": 12.97,
	"longitude": 77.59,
	"timezone": "Asia/Kolkata",
	"timezone_abbreviation": "GMT+5:30",
	"utc_offset_seconds": 19800,
	"elevation": 918.0,
	"generationtime_ms": 0.3,
	"current_units": {"time": "iso8601", "interval": "seconds", "temperature_2m": "°C", "apparent_temperature": "°C", "weather_code": "wmo code", "relative_humidity_2m": "%", "wind_speed_10m": "km/h", "wind_direction_10m": "°", "precipitation": "mm"},
	"current": {"time": "2026-08-03T13:30", "interval": 900, "temperature_2m": 27.2, "apparent_temperature": 28.8, "weather_code": 51, "relative_humidity_2m": 63, "wind_speed_10m": 16.9, "wind_direction_10m": 284, "precipitation": 0.1},
	"hourly_units": {"time": "iso8601", "temperature_2m": "°C", "weather_code": "wmo code", "precipitation": "mm"},
	"hourly": {"time": ["2026-08-03T00:00", "2026-08-03T01:00"], "temperature_2m": [21.9, 21.5], "weather_code": [3, 2], "precipitation": [0.0, 0.1]},
	"daily_units": {"time": "iso8601", "temperature_2m_max": "°C", "temperature_2m_min": "°C", "weather_code": "wmo code", "sunrise": "iso8601", "sunset": "iso8601", "precipitation_probability_max": "%"},
	"daily": {"time": ["2026-08-03", "2026-08-04"], "temperature_2m_max": [27.2, 27.0], "temperature_2m_min": [20.6, 20.4], "weather_code": [55, 61], "sunrise": ["2026-08-03T06:05", "2026-08-04T06:05"], "sunset": ["2026-08-03T18:46", "2026-08-04T18:46"], "precipitation_probability_max": [78, None]},
}
FORECAST_BYTES = json.dumps(FORECAST_RESPONSE).encode()
FORECAST_DATA = parse_forecast(FORECAST_BYTES)

GEOCODE_RESPONSE = {
	"results": [{"id": 1277333, "name": "Bengaluru", "latitude": 12.97194, "longitude": 77.59369, "country": "India", "country_code": "IN", "admin1": "Karnataka", "timezone": "Asia/Kolkata", "population": 8495492}],
	"generationtime_ms": 0.3,
}
GEOCODE_BYTES = json.dumps(GEOCODE_RESPONSE).encode()
GEOCODE_EMPTY_BYTES = json.dumps({"generationtime_ms": 0.6}).encode()
GEOCODE_DATA = parse_geocoding(GEOCODE_BYTES)


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


class TestOpenMeteoProvider(UnitTestCase):
	def test_parses_and_normalizes_forecast(self) -> None:
		parsed = parse_forecast(FORECAST_BYTES)

		self.assertEqual(parsed["timezone"], "Asia/Kolkata")
		self.assertEqual(parsed["current"]["temperature"], 27.2)
		self.assertEqual(parsed["current"]["weatherCode"], 51)
		self.assertEqual(len(parsed["hourly"]), 2)
		self.assertEqual(len(parsed["daily"]), 2)
		self.assertIsNone(parsed["daily"][1]["precipitationProbabilityMax"])
		self.assertEqual(parsed["source"]["attribution"], "Weather data by Open-Meteo.com")
		self.assertEqual(parsed["source"]["license_name"], "CC BY 4.0")

	def test_parses_geocoding_and_treats_missing_results_as_empty(self) -> None:
		parsed = parse_geocoding(GEOCODE_BYTES)
		self.assertEqual(parsed["results"][0]["name"], "Bengaluru")
		self.assertEqual(parsed["results"][0]["timezone"], "Asia/Kolkata")
		self.assertEqual(parsed["results"][0]["countryCode"], "IN")
		self.assertEqual(parsed["source"]["attribution"], "Weather data by Open-Meteo.com")

		self.assertEqual(parse_geocoding(GEOCODE_EMPTY_BYTES)["results"], [])

	def test_rejects_invalid_and_incomplete_forecast(self) -> None:
		bad_code = {**FORECAST_RESPONSE, "current": {**FORECAST_RESPONSE["current"], "weather_code": 250}}
		short_series = {**FORECAST_RESPONSE, "hourly": {**FORECAST_RESPONSE["hourly"], "temperature_2m": [21.9]}}
		missing_current = {key: value for key, value in FORECAST_RESPONSE.items() if key != "current"}
		payloads = (
			b"not json",
			b"[]",
			json.dumps(bad_code).encode(),
			json.dumps(short_series).encode(),
			json.dumps(missing_current).encode(),
		)
		for payload in payloads:
			with self.subTest(payload=payload[:24]):
				self.assertRaises(WeatherProviderError, parse_forecast, payload)

	def test_flags_open_meteo_error_payloads(self) -> None:
		body = json.dumps({"error": True, "reason": "Latitude must be in range."}).encode()
		self.assertRaises(WeatherProviderError, parse_forecast, body)

	def test_wraps_network_failures(self) -> None:
		session = Mock()
		session.get.side_effect = requests.RequestException("offline")
		provider = OpenMeteoProvider(session)

		self.assertRaises(WeatherProviderError, provider.forecast, 12.97, 77.59, "auto")
		self.assertRaises(WeatherProviderError, provider.geocode, "Bengaluru")

	def test_rejects_non_200_and_oversized_responses(self) -> None:
		session = Mock()
		session.get.return_value = Mock(status_code=400, content=b'{"error":true}')
		self.assertRaises(WeatherProviderError, OpenMeteoProvider(session).forecast, 12.97, 77.59, "auto")

		session.get.return_value = Mock(status_code=200, content=b"x" * (MAX_RESPONSE_BYTES + 1))
		self.assertRaises(WeatherProviderError, OpenMeteoProvider(session).forecast, 12.97, 77.59, "auto")

	def test_sends_bounded_request_with_timeout(self) -> None:
		session = Mock()
		session.get.return_value = Mock(status_code=200, content=FORECAST_BYTES)

		OpenMeteoProvider(session).forecast(12.97, 77.59, "Asia/Kolkata")

		call = session.get.call_args
		self.assertEqual(call.kwargs["timeout"], (3.05, 10))
		self.assertEqual(call.kwargs["params"]["latitude"], 12.97)
		self.assertEqual(call.kwargs["params"]["timezone"], "Asia/Kolkata")
		self.assertIn("temperature_2m", call.kwargs["params"]["current"])


class TestWeatherForecastService(UnitTestCase):
	def test_fetches_once_then_uses_shared_cache(self) -> None:
		cache = FakeCache()
		provider = Mock()
		provider.forecast.return_value = _forecast_data()
		service = WeatherForecastService(12.97, 77.59, provider=provider, cache=cache, clock=lambda: NOW)

		self.assertEqual(service.get()["cacheStatus"], "live")
		self.assertEqual(service.get()["cacheStatus"], "cached")
		provider.forecast.assert_called_once_with(12.97, 77.59, "auto")
		self.assertEqual(cache.lock_calls, 1)

	def test_returns_honestly_labeled_stale_cache_after_failure(self) -> None:
		cache = FakeCache()
		cache.value = self._cached(NOW - timedelta(hours=3))
		provider = Mock()
		provider.forecast.side_effect = WeatherProviderError("failed")

		response = WeatherForecastService(12.97, 77.59, provider=provider, cache=cache, clock=lambda: NOW).get()

		self.assertEqual(response["cacheStatus"], "stale")
		self.assertEqual(response["current"]["temperature"], 27.2)

	def test_fails_cleanly_without_any_cached_forecast(self) -> None:
		provider = Mock()
		provider.forecast.side_effect = WeatherProviderError("failed")
		with self.assertRaises(ServiceUnavailableError):
			WeatherForecastService(12.97, 77.59, provider=provider, cache=FakeCache(), clock=lambda: NOW).get()

	def test_returns_stale_cache_when_another_refresh_holds_the_lock(self) -> None:
		cache = FakeCache()
		cache.value = self._cached(NOW - timedelta(hours=1))
		cache.lock = Mock(side_effect=LockError("busy"))

		response = WeatherForecastService(12.97, 77.59, provider=Mock(), cache=cache, clock=lambda: NOW).get()

		self.assertEqual(response["cacheStatus"], "stale")

	def test_strips_internal_validators_from_public_payload(self) -> None:
		cache = FakeCache()
		provider = Mock()
		provider.forecast.return_value = _forecast_data()

		response = WeatherForecastService(12.97, 77.59, provider=provider, cache=cache, clock=lambda: NOW).get()

		self.assertNotIn("validators", response)
		self.assertEqual(response["forecastNotice"], FORECAST_NOTICE)
		self.assertIn("validators", cache.value)

	def test_public_endpoints_are_guest_get_only(self) -> None:
		for endpoint in (search_locations, get_forecast):
			with self.subTest(endpoint=endpoint.__name__):
				self.assertIn(endpoint, frappe.whitelisted)
				self.assertIn(endpoint, frappe.guest_methods)
				self.assertEqual(
					frappe.allowed_http_methods_for_whitelisted_func[endpoint], ("GET", "QUERY")
				)

	def test_rejects_out_of_range_and_non_numeric_coordinates(self) -> None:
		for latitude, longitude in ((91, 0), (-91, 0), (0, 181), (0, -181), ("north", 0)):
			with self.subTest(latitude=latitude, longitude=longitude):
				with self.assertRaises(frappe.ValidationError):
					get_forecast(latitude, longitude)

	@staticmethod
	def _cached(checked_at: datetime) -> dict[str, object]:
		return {
			**_forecast_data(),
			"providerCheckedAt": checked_at.isoformat(),
			"validators": {"latitude": 12.97, "longitude": 77.59, "timezone": "auto"},
		}


class TestLocationSearchService(UnitTestCase):
	def test_caches_geocoding_results_under_a_normalized_key(self) -> None:
		cache = FakeCache()
		provider = Mock()
		provider.geocode.return_value = _geocode_data()
		service = LocationSearchService(provider=provider, cache=cache)

		first = service.search("Bengaluru")
		second = service.search("bengaluru")

		self.assertEqual(first["results"][0]["name"], "Bengaluru")
		self.assertEqual(second["results"][0]["name"], "Bengaluru")
		self.assertEqual(first["source"]["attribution"], "Weather data by Open-Meteo.com")
		provider.geocode.assert_called_once_with("Bengaluru")
		self.assertEqual(cache.set_calls, 1)

	def test_rejects_short_and_unbounded_queries(self) -> None:
		service = LocationSearchService(provider=Mock(), cache=FakeCache())
		with self.assertRaises(frappe.ValidationError):
			service.search("a")
		with self.assertRaises(frappe.ValidationError):
			service.search("a" * 81)

	def test_reports_unavailable_when_geocoding_fails_with_no_cache(self) -> None:
		provider = Mock()
		provider.geocode.side_effect = WeatherProviderError("offline")
		service = LocationSearchService(provider=provider, cache=FakeCache())
		with self.assertRaises(ServiceUnavailableError):
			service.search("Bengaluru")


def _forecast_data() -> dict[str, object]:
	return json.loads(json.dumps(FORECAST_DATA))


def _geocode_data() -> dict[str, object]:
	return json.loads(json.dumps(GEOCODE_DATA))
