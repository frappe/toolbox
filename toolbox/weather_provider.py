# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

import json
import math

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
CURRENT_FIELDS = (
	"temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,"
	"wind_speed_10m,wind_direction_10m,precipitation"
)
HOURLY_FIELDS = "temperature_2m,weather_code,precipitation"
DAILY_FIELDS = "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max"
MAX_RESPONSE_BYTES = 256 * 1024
MAX_HOURLY_POINTS = 240
MAX_DAILY_POINTS = 16
MAX_GEOCODING_RESULTS = 20
_SOURCE = {
	"name": "Open-Meteo",
	"url": "https://open-meteo.com/",
	"license_name": "CC BY 4.0",
	"license_url": "https://open-meteo.com/en/license",
	"attribution": "Weather data by Open-Meteo.com",
}


class WeatherProviderError(Exception):
	pass


class OpenMeteoProvider:
	def __init__(self, session: object = requests) -> None:
		self.session = session

	def geocode(self, name: str, count: int = 5) -> dict[str, object]:
		params = {
			"name": name,
			"count": _bounded_count(count),
			"language": "en",
			"format": "json",
		}
		return parse_geocoding(self._fetch(GEOCODING_URL, params))

	def forecast(self, latitude: float, longitude: float, timezone: str) -> dict[str, object]:
		params = {
			"latitude": latitude,
			"longitude": longitude,
			"timezone": timezone or "auto",
			"current": CURRENT_FIELDS,
			"hourly": HOURLY_FIELDS,
			"daily": DAILY_FIELDS,
		}
		return parse_forecast(self._fetch(FORECAST_URL, params))

	def _fetch(self, url: str, params: dict[str, object]) -> bytes:
		headers = {
			"Accept": "application/json",
			"User-Agent": "Frappe-Toolbox/1.0 (+https://frappe.io)",
		}
		try:
			response = self.session.get(url, params=params, headers=headers, timeout=(3.05, 10))
		except requests.RequestException as error:
			raise WeatherProviderError("The Open-Meteo service is unavailable.") from error

		if response.status_code != 200:
			raise WeatherProviderError("The Open-Meteo service returned an unexpected status.")
		if len(response.content) > MAX_RESPONSE_BYTES:
			raise WeatherProviderError("The Open-Meteo response is too large.")
		return response.content


def parse_geocoding(content: bytes) -> dict[str, object]:
	payload = _load_payload(content)
	results = payload.get("results")
	if results is None:
		normalized: list[dict[str, object]] = []
	elif isinstance(results, list):
		normalized = [_normalize_location(item) for item in results[:MAX_GEOCODING_RESULTS]]
	else:
		raise WeatherProviderError("The Open-Meteo geocoding response is malformed.")
	return {"schemaVersion": 1, "results": normalized, "source": _source()}


def parse_forecast(content: bytes) -> dict[str, object]:
	payload = _load_payload(content)
	current_units = _require_dict(payload.get("current_units"), "current_units")
	current = _require_dict(payload.get("current"), "current")
	hourly = _require_dict(payload.get("hourly"), "hourly")
	daily = _require_dict(payload.get("daily"), "daily")
	return {
		"schemaVersion": 1,
		"latitude": _number(payload.get("latitude"), "latitude"),
		"longitude": _number(payload.get("longitude"), "longitude"),
		"timezone": _text(payload.get("timezone"), "timezone"),
		"timezoneAbbreviation": _optional_text(payload.get("timezone_abbreviation")),
		"utcOffsetSeconds": _optional_int(payload.get("utc_offset_seconds"), "utc_offset_seconds"),
		"elevation": _optional_number(payload.get("elevation"), "elevation"),
		"units": {
			"temperature": _optional_text(current_units.get("temperature_2m")),
			"apparentTemperature": _optional_text(current_units.get("apparent_temperature")),
			"precipitation": _optional_text(current_units.get("precipitation")),
			"windSpeed": _optional_text(current_units.get("wind_speed_10m")),
			"windDirection": _optional_text(current_units.get("wind_direction_10m")),
			"relativeHumidity": _optional_text(current_units.get("relative_humidity_2m")),
		},
		"current": _normalize_current(current),
		"hourly": _normalize_hourly(hourly),
		"daily": _normalize_daily(daily),
		"source": _source(),
	}


def _normalize_current(current: dict[str, object]) -> dict[str, object]:
	return {
		"time": _text(current.get("time"), "current.time"),
		"temperature": _number(current.get("temperature_2m"), "current.temperature_2m"),
		"apparentTemperature": _number(current.get("apparent_temperature"), "current.apparent_temperature"),
		"weatherCode": _weather_code(current.get("weather_code"), "current.weather_code"),
		"relativeHumidity": _optional_number(current.get("relative_humidity_2m"), "current.relative_humidity_2m"),
		"windSpeed": _number(current.get("wind_speed_10m"), "current.wind_speed_10m"),
		"windDirection": _optional_number(current.get("wind_direction_10m"), "current.wind_direction_10m"),
		"precipitation": _optional_number(current.get("precipitation"), "current.precipitation"),
	}


def _normalize_hourly(hourly: dict[str, object]) -> list[dict[str, object]]:
	times = _time_axis(hourly.get("time"), "hourly.time", MAX_HOURLY_POINTS)
	length = len(times)
	temperatures = _number_series(hourly.get("temperature_2m"), "hourly.temperature_2m", length)
	codes = _code_series(hourly.get("weather_code"), "hourly.weather_code", length)
	precipitation = _optional_number_series(hourly.get("precipitation"), "hourly.precipitation", length)
	return [
		{
			"time": times[index],
			"temperature": temperatures[index],
			"weatherCode": codes[index],
			"precipitation": precipitation[index],
		}
		for index in range(length)
	]


def _normalize_daily(daily: dict[str, object]) -> list[dict[str, object]]:
	dates = _time_axis(daily.get("time"), "daily.time", MAX_DAILY_POINTS)
	length = len(dates)
	maxima = _number_series(daily.get("temperature_2m_max"), "daily.temperature_2m_max", length)
	minima = _number_series(daily.get("temperature_2m_min"), "daily.temperature_2m_min", length)
	codes = _code_series(daily.get("weather_code"), "daily.weather_code", length)
	sunrise = _string_series(daily.get("sunrise"), "daily.sunrise", length)
	sunset = _string_series(daily.get("sunset"), "daily.sunset", length)
	precipitation_probability = _optional_number_series(
		daily.get("precipitation_probability_max"), "daily.precipitation_probability_max", length
	)
	return [
		{
			"date": dates[index],
			"temperatureMax": maxima[index],
			"temperatureMin": minima[index],
			"weatherCode": codes[index],
			"sunrise": sunrise[index],
			"sunset": sunset[index],
			"precipitationProbabilityMax": precipitation_probability[index],
		}
		for index in range(length)
	]


def _load_payload(content: bytes) -> dict[str, object]:
	try:
		payload = json.loads(content)
	except (ValueError, TypeError) as error:
		raise WeatherProviderError("The Open-Meteo response is not valid JSON.") from error
	if not isinstance(payload, dict):
		raise WeatherProviderError("The Open-Meteo response has an unexpected shape.")
	if payload.get("error"):
		raise WeatherProviderError("The Open-Meteo service reported an error.")
	return payload


def _normalize_location(item: object) -> dict[str, object]:
	if not isinstance(item, dict):
		raise WeatherProviderError("The Open-Meteo geocoding result is malformed.")
	return {
		"id": _optional_int(item.get("id"), "id"),
		"name": _text(item.get("name"), "name"),
		"latitude": _coordinate(item.get("latitude"), 90.0, "latitude"),
		"longitude": _coordinate(item.get("longitude"), 180.0, "longitude"),
		"country": _optional_text(item.get("country")),
		"countryCode": _optional_text(item.get("country_code")),
		"admin1": _optional_text(item.get("admin1")),
		"timezone": _optional_text(item.get("timezone")),
		"population": _optional_int(item.get("population"), "population"),
	}


def _require_dict(value: object, field: str) -> dict[str, object]:
	if not isinstance(value, dict):
		raise WeatherProviderError(f"The Open-Meteo forecast is missing {field}.")
	return value


def _time_axis(value: object, field: str, maximum: int) -> list[str]:
	if not isinstance(value, list) or not value:
		raise WeatherProviderError(f"The Open-Meteo forecast is missing {field}.")
	if len(value) > maximum:
		raise WeatherProviderError(f"The Open-Meteo forecast {field} is too long.")
	return [_text(item, field) for item in value]


def _series(value: object, field: str, length: int) -> list:
	if not isinstance(value, list):
		raise WeatherProviderError(f"The Open-Meteo forecast is missing {field}.")
	if len(value) != length:
		raise WeatherProviderError(f"The Open-Meteo forecast {field} is inconsistent.")
	return value


def _string_series(value: object, field: str, length: int) -> list[str]:
	return [_text(item, field) for item in _series(value, field, length)]


def _number_series(value: object, field: str, length: int) -> list[float]:
	return [_number(item, field) for item in _series(value, field, length)]


def _code_series(value: object, field: str, length: int) -> list[int]:
	return [_weather_code(item, field) for item in _series(value, field, length)]


def _optional_number_series(value: object, field: str, length: int) -> list[float | None]:
	return [_optional_number(item, field) for item in _series(value, field, length)]


def _coordinate(value: object, bound: float, field: str) -> float:
	number = _number(value, field)
	if number < -bound or number > bound:
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	return number


def _weather_code(value: object, field: str) -> int:
	if isinstance(value, bool) or not isinstance(value, int):
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	if value < 0 or value > 99:
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	return value


def _number(value: object, field: str) -> float:
	if isinstance(value, bool) or not isinstance(value, (int, float)):
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	number = float(value)
	if not math.isfinite(number):
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	return number


def _optional_number(value: object, field: str) -> float | None:
	if value is None:
		return None
	return _number(value, field)


def _text(value: object, field: str) -> str:
	if not isinstance(value, str) or not value.strip():
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	return value


def _optional_text(value: object) -> str | None:
	if value is None:
		return None
	if not isinstance(value, str):
		raise WeatherProviderError("The Open-Meteo response has an invalid text field.")
	return value


def _optional_int(value: object, field: str) -> int | None:
	if value is None:
		return None
	if isinstance(value, bool) or not isinstance(value, int):
		raise WeatherProviderError(f"The Open-Meteo response has an invalid {field}.")
	return value


def _bounded_count(count: object) -> int:
	try:
		value = int(count)
	except (TypeError, ValueError):
		return 5
	return max(1, min(value, 10))


def _source() -> dict[str, str]:
	return dict(_SOURCE)
