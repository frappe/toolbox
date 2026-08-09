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
	WeatherForecastService,
	get_forecast,
	search_locations,
)
from toolbox.weather_forecast import (
	Forecast,
	WeatherProviderError,
	apparent_temperature,
	local_wall_clock,
	resolve_zone,
)
from toolbox.weather_provider import MAX_RESPONSE_BYTES, MetNoProvider
from toolbox.weather_symbols import SYMBOL_CODES, wmo_code

NOW = datetime(2026, 8, 3, 12, 0, tzinfo=timezone.utc)
KOLKATA = resolve_zone("Asia/Kolkata")


def _point(time: str, temperature: float, **blocks: object) -> dict[str, object]:
	instant = {
		"air_temperature": temperature,
		"relative_humidity": 60.0,
		"wind_speed": 4.0,
		"wind_from_direction": 250.0,
	}
	return {"time": time, "data": {"instant": {"details": instant}, **blocks}}


def _summary(symbol: str, **details: object) -> dict[str, object]:
	return {"summary": {"symbol_code": symbol}, "details": details}


# 03:00Z is 08:30 in Kolkata, so every point below lands on 2026-08-03 local except the last,
# which crosses into the next local day.
FORECAST_RESPONSE = {
	"properties": {
		"meta": {"units": {"air_temperature": "celsius", "wind_speed": "m/s"}},
		"timeseries": [
			_point(
				"2026-08-03T03:00:00Z",
				27.2,
				next_1_hours=_summary("rain", precipitation_amount=0.4),
				next_6_hours=_summary("lightrain", air_temperature_max=29.0, air_temperature_min=26.0),
			),
			_point(
				"2026-08-03T09:00:00Z",
				24.0,
				next_1_hours=_summary("partlycloudy_night", precipitation_amount=0.0),
				next_6_hours=_summary("cloudy", air_temperature_max=25.0, air_temperature_min=21.0),
			),
			# 18:00Z is 23:30 local, so this six-hour block runs into tomorrow.
			_point(
				"2026-08-03T18:00:00Z",
				22.0,
				next_6_hours=_summary("heavyrainshowers", air_temperature_max=35.0, air_temperature_min=5.0),
			),
			_point("2026-08-04T03:00:00Z", 26.0, next_1_hours=_summary("clearsky_day", precipitation_amount=0.0)),
			# The last point of a real series carries no block at all, so it has no condition.
			_point("2026-08-04T09:00:00Z", 24.0),
		],
	}
}
FORECAST_BYTES = json.dumps(FORECAST_RESPONSE).encode()
SUNRISE_RESPONSE = {
	"properties": {
		"sunrise": {"time": "2026-08-03T06:05:00Z", "azimuth": 73.0},
		"sunset": {"time": "2026-08-03T13:15:00Z", "azimuth": 286.0},
	}
}
POLAR_SUNRISE_RESPONSE = {
	"properties": {"sunrise": {"time": None, "azimuth": None}, "sunset": {"time": None, "azimuth": None}}
}


class FakeCache:
	def __init__(self) -> None:
		self.value = None
		self.values: dict[str, object] = {}
		self.set_calls = 0
		self.lock_calls = 0

	def get_value(self, key: str = "", *_args: object, **_kwargs: object) -> object:
		if self.values:
			return self.values.get(key)
		return self.value

	def set_value(self, key: str, value: object, **_kwargs: object) -> None:
		self.value = value
		self.values[key] = value
		self.set_calls += 1

	def lock(self, *_args: object, **_kwargs: object) -> nullcontext:
		self.lock_calls += 1
		return nullcontext()


def _response(payload: object, status_code: int = 200) -> Mock:
	return Mock(status_code=status_code, content=json.dumps(payload).encode())


def _session(forecast: object = FORECAST_RESPONSE, sun: object = SUNRISE_RESPONSE) -> Mock:
	session = Mock()
	session.get.side_effect = lambda url, **_kwargs: _response(sun if "sunrise" in url else forecast)
	return session


class TestWeatherSymbols(UnitTestCase):
	def test_reads_a_symbol_through_its_daylight_variant(self) -> None:
		self.assertEqual(wmo_code("clearsky_day"), 0)
		self.assertEqual(wmo_code("clearsky_night"), 0)
		self.assertEqual(wmo_code("partlycloudy_polartwilight"), 2)
		self.assertEqual(wmo_code("cloudy"), 3)

	def test_maps_met_s_own_misspelled_symbols(self) -> None:
		"""MET publishes "lights" for two thunder symbols and sends them that way."""
		self.assertEqual(wmo_code("lightssleetshowersandthunder_day"), 95)
		self.assertEqual(wmo_code("lightssnowshowersandthunder"), 95)

	def test_grades_intensity_and_flattens_thunder(self) -> None:
		self.assertEqual([wmo_code(name) for name in ("lightrain", "rain", "heavyrain")], [61, 63, 65])
		self.assertEqual([wmo_code(name) for name in ("lightsleet", "sleet", "heavysleet")], [68, 69, 69])
		self.assertEqual(wmo_code("heavyrainandthunder"), 95)

	def test_every_published_symbol_is_a_valid_wmo_code(self) -> None:
		self.assertEqual(len(SYMBOL_CODES), 41)
		for symbol, code in SYMBOL_CODES.items():
			with self.subTest(symbol=symbol):
				self.assertTrue(0 <= code <= 99)

	def test_reports_an_unknown_or_absent_symbol_rather_than_guessing(self) -> None:
		for value in ("sandstorm", "", None, 3):
			with self.subTest(value=value):
				self.assertIsNone(wmo_code(value))


class TestApparentTemperature(UnitTestCase):
	def test_wind_cools_and_humidity_warms(self) -> None:
		still = apparent_temperature(30.0, 50.0, 0.0)
		windy = apparent_temperature(30.0, 50.0, 10.0)
		humid = apparent_temperature(30.0, 90.0, 0.0)

		self.assertLess(windy, still)
		self.assertGreater(humid, still)

	def test_missing_readings_drop_out_of_the_formula(self) -> None:
		self.assertEqual(apparent_temperature(20.0, None, None), 16.0)


class TestForecastTranslation(UnitTestCase):
	def setUp(self) -> None:
		self.payload = Forecast(FORECAST_RESPONSE, KOLKATA, 12.97, 77.59).to_payload({
			"2026-08-03": {"sunrise": "2026-08-03T11:35", "sunset": "2026-08-03T18:45"}
		})

	def test_rewrites_utc_instants_as_the_place_s_wall_clock(self) -> None:
		self.assertEqual(self.payload["timezone"], "Asia/Kolkata")
		self.assertEqual(self.payload["current"]["time"], "2026-08-03T08:30")
		self.assertEqual([hour["time"] for hour in self.payload["hourly"]][:2], ["2026-08-03T08:30", "2026-08-03T14:30"])

	def test_publishes_wind_in_km_h_and_an_apparent_temperature(self) -> None:
		current = self.payload["current"]

		self.assertEqual(self.payload["units"]["windSpeed"], "km/h")
		self.assertEqual(current["windSpeed"], 14.4)
		self.assertEqual(current["apparentTemperature"], apparent_temperature(27.2, 60.0, 4.0))

	def test_omits_a_point_that_carries_no_symbol_from_the_hourly_series(self) -> None:
		"""The last point of a MET series carries no block, so it has no condition to show."""
		hours = [hour["time"] for hour in self.payload["hourly"]]

		self.assertEqual(len(hours), 4)
		self.assertNotIn("2026-08-04T14:30", hours)

	def test_falls_back_to_a_longer_block_for_a_condition(self) -> None:
		"""Past about two days MET drops to six-hourly, and only the longer block has a symbol."""
		self.assertEqual(self.payload["hourly"][2], {
			"time": "2026-08-03T23:30",
			"temperature": 22.0,
			"weatherCode": 82,
			"precipitation": None,
		})

	def test_reports_only_the_one_hour_precipitation_for_an_hour(self) -> None:
		"""A six-hour total printed under an hourly card would read as an hour of rain."""
		self.assertEqual([hour["precipitation"] for hour in self.payload["hourly"]], [0.4, 0.0, None, 0.0])

	def test_takes_daily_extremes_from_blocks_that_stay_inside_the_day(self) -> None:
		today = self.payload["daily"][0]

		self.assertEqual(today["temperatureMax"], 29.0)
		self.assertEqual(today["temperatureMin"], 21.0)

	def test_reports_the_day_s_most_significant_condition(self) -> None:
		self.assertEqual(self.payload["daily"][0]["weatherCode"], 82)

	def test_carries_the_sun_times_it_was_given_and_tolerates_none(self) -> None:
		today, tomorrow = self.payload["daily"]

		self.assertEqual(today["sunrise"], "2026-08-03T11:35")
		self.assertIsNone(tomorrow["sunrise"])
		self.assertIsNone(tomorrow["sunset"])

	def test_reports_no_precipitation_probability_outside_the_nordic_area(self) -> None:
		self.assertIsNone(self.payload["daily"][0]["precipitationProbabilityMax"])

	def test_names_met_norway_as_the_source(self) -> None:
		self.assertEqual(self.payload["source"]["attribution"], "Weather data from MET Norway")
		self.assertEqual(self.payload["source"]["license_name"], "CC BY 4.0")

	def test_rejects_a_payload_with_no_usable_points(self) -> None:
		for payload in ([], {}, {"properties": {}}, {"properties": {"timeseries": []}}):
			with self.subTest(payload=payload), self.assertRaises(WeatherProviderError):
				Forecast(payload, KOLKATA, 12.97, 77.59)


class TestTimeZoneResolution(UnitTestCase):
	def test_falls_back_to_utc_for_a_name_the_browser_should_not_have_sent(self) -> None:
		for name in ("", None, "Not/AZone", "../../etc/passwd", "x" * 65):
			with self.subTest(name=name):
				self.assertEqual(str(resolve_zone(name)), "UTC")

	def test_reads_an_offset_carrying_timestamp_as_local_wall_clock(self) -> None:
		self.assertEqual(local_wall_clock("2026-08-03T06:05:00Z", KOLKATA), "2026-08-03T11:35")
		self.assertEqual(local_wall_clock("2026-08-03T06:05+05:30", KOLKATA), "2026-08-03T06:05")
		self.assertIsNone(local_wall_clock(None, KOLKATA))
		self.assertIsNone(local_wall_clock("half past six", KOLKATA))


class TestMetNoProvider(UnitTestCase):
	def test_identifies_itself_and_bounds_every_request(self) -> None:
		session = _session()

		MetNoProvider(session, FakeCache()).forecast(12.97194, 77.59369, "Asia/Kolkata")

		forecast_call = session.get.call_args_list[0]
		self.assertIn("frappe.tools", forecast_call.kwargs["headers"]["User-Agent"])
		self.assertEqual(forecast_call.kwargs["timeout"], (3.05, 10))
		# MET asks callers to trim coordinates so that its own cache can answer them.
		self.assertEqual(forecast_call.kwargs["params"], {"lat": 12.9719, "lon": 77.5937})

	def test_asks_for_sun_times_once_per_day_then_reads_them_from_the_cache(self) -> None:
		cache = FakeCache()
		session = _session()

		first = MetNoProvider(session, cache).forecast(12.97, 77.59, "Asia/Kolkata")
		sun_calls = [call for call in session.get.call_args_list if "sunrise" in call.args[0]]
		MetNoProvider(session, cache).forecast(12.97, 77.59, "Asia/Kolkata")
		repeat_sun_calls = [call for call in session.get.call_args_list if "sunrise" in call.args[0]]

		self.assertEqual(len(sun_calls), 2)
		self.assertEqual(len(repeat_sun_calls), 2)
		self.assertEqual(first["daily"][0]["sunrise"], "2026-08-03T11:35")

	def test_reports_no_sun_times_above_the_polar_circles(self) -> None:
		payload = MetNoProvider(_session(sun=POLAR_SUNRISE_RESPONSE), FakeCache()).forecast(
			78.22, 15.63, "Arctic/Longyearbyen"
		)

		self.assertIsNone(payload["daily"][0]["sunrise"])
		self.assertIsNone(payload["daily"][0]["sunset"])

	def test_a_failing_sun_lookup_costs_one_line_not_the_forecast(self) -> None:
		session = Mock()
		session.get.side_effect = lambda url, **_kwargs: (
			_response(None, status_code=503) if "sunrise" in url else _response(FORECAST_RESPONSE)
		)

		payload = MetNoProvider(session, FakeCache()).forecast(12.97, 77.59, "Asia/Kolkata")

		self.assertIsNone(payload["daily"][0]["sunrise"])
		self.assertEqual(payload["current"]["temperature"], 27.2)

	def test_wraps_network_failures_and_unusable_responses(self) -> None:
		offline = Mock()
		offline.get.side_effect = requests.RequestException("offline")
		self.assertRaises(WeatherProviderError, MetNoProvider(offline, FakeCache()).forecast, 12.97, 77.59, "UTC")

		rejected = Mock()
		rejected.get.return_value = Mock(status_code=429, content=b"{}")
		self.assertRaises(WeatherProviderError, MetNoProvider(rejected, FakeCache()).forecast, 12.97, 77.59, "UTC")

		oversized = Mock()
		oversized.get.return_value = Mock(status_code=200, content=b"x" * (MAX_RESPONSE_BYTES + 1))
		self.assertRaises(WeatherProviderError, MetNoProvider(oversized, FakeCache()).forecast, 12.97, 77.59, "UTC")

		malformed = Mock()
		malformed.get.return_value = Mock(status_code=200, content=b"not json")
		self.assertRaises(WeatherProviderError, MetNoProvider(malformed, FakeCache()).forecast, 12.97, 77.59, "UTC")


class TestWeatherForecastService(UnitTestCase):
	def test_fetches_once_then_uses_shared_cache(self) -> None:
		cache = FakeCache()
		provider = Mock()
		provider.forecast.return_value = _forecast_data()
		service = WeatherForecastService(12.97, 77.59, provider=provider, cache=cache, clock=lambda: NOW)

		self.assertEqual(service.get()["cacheStatus"], "live")
		self.assertEqual(service.get()["cacheStatus"], "cached")
		provider.forecast.assert_called_once_with(12.97, 77.59, "")
		self.assertEqual(cache.lock_calls, 1)

	def test_keys_a_cached_forecast_by_its_time_zone(self) -> None:
		"""Every published time is local, so one coordinate in two zones is two forecasts."""
		kolkata = WeatherForecastService(12.97, 77.59, "Asia/Kolkata", provider=Mock(), cache=FakeCache())
		utc = WeatherForecastService(12.97, 77.59, "UTC", provider=Mock(), cache=FakeCache())

		self.assertNotEqual(kolkata.cache_key, utc.cache_key)

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
			"validators": {"latitude": 12.97, "longitude": 77.59, "timezone": ""},
		}


def _forecast_data() -> dict[str, object]:
	payload = Forecast(FORECAST_RESPONSE, KOLKATA, 12.97, 77.59).to_payload({})
	return json.loads(json.dumps(payload))
