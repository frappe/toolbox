# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Turn a MET Norway Locationforecast payload into the Weather tool's forecast contract.

Pure translation, so it can be tested without a network or a site. Three of MET's choices
differ from what the frontend expects, and all three are settled here:

- MET timestamps are UTC. The frontend reads the clock digits straight out of the string,
  so every time is rewritten as the place's local wall clock with no offset.
- MET reports no apparent temperature, so it is computed with Steadman's formula.
- MET reports one instant per point and no daily summary, so daily extremes, condition, and
  precipitation probability are aggregated by local date.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from toolbox.weather_symbols import wmo_code

MAX_TIMESERIES_POINTS = 200
MAX_HOURLY_POINTS = 192
# Eight days keeps the seven the interface shows, and bounds the sun-time lookups to eight.
MAX_DAILY_DAYS = 8
FORECAST_BLOCKS = ("next_1_hours", "next_6_hours", "next_12_hours")
OVERCAST_CODE = 3
UTC = ZoneInfo("UTC")
_SOURCE = {
	"name": "MET Norway",
	"url": "https://www.met.no/en",
	"license_name": "CC BY 4.0",
	"license_url": "https://creativecommons.org/licenses/by/4.0/",
	"attribution": "Weather data from MET Norway",
}
_UNITS = {
	"temperature": "°C",
	"apparentTemperature": "°C",
	"precipitation": "mm",
	"windSpeed": "km/h",
	"windDirection": "°",
	"relativeHumidity": "%",
}


class WeatherProviderError(Exception):
	"""The provider's data cannot be turned into a usable forecast."""


class Forecast:
	"""One Locationforecast response, parsed into local time and ready to publish.

	Sun times arrive separately, from a second MET service, so the caller reads `dates` to
	learn which days to look up and then hands them back to `to_payload`.
	"""

	def __init__(self, payload: object, zone: ZoneInfo, latitude: float, longitude: float) -> None:
		self.zone = zone
		self.latitude = latitude
		self.longitude = longitude
		self.points = _parse_points(_timeseries(payload), zone)
		if not self.points:
			raise WeatherProviderError("The MET Norway forecast has no usable points.")

	@property
	def dates(self) -> list[str]:
		"""Local dates the forecast covers, in order, capped at what the contract publishes."""
		return list(dict.fromkeys(point.date for point in self.points))[:MAX_DAILY_DAYS]

	def to_payload(self, sun_times: Mapping[str, Mapping[str, str | None]]) -> dict[str, object]:
		return {
			"schemaVersion": 1,
			"latitude": self.latitude,
			"longitude": self.longitude,
			"timezone": str(self.zone),
			"units": dict(_UNITS),
			"current": _build_current(self.points[0]),
			"hourly": _build_hourly(self.points),
			"daily": self._build_daily(sun_times),
			"source": dict(_SOURCE),
		}

	def _build_daily(self, sun_times: Mapping[str, Mapping[str, str | None]]) -> list[dict[str, object]]:
		grouped: dict[str, list[_Point]] = {}
		for point in self.points:
			grouped.setdefault(point.date, []).append(point)

		daily = []
		for date in self.dates:
			day = grouped[date]
			temperatures = _day_temperatures(day)
			sun = sun_times.get(date) or {}
			daily.append({
				"date": date,
				"temperatureMax": max(temperatures),
				"temperatureMin": min(temperatures),
				"weatherCode": _day_weather_code(day),
				"sunrise": sun.get("sunrise"),
				"sunset": sun.get("sunset"),
				"precipitationProbabilityMax": _day_precipitation_probability(day),
			})
		return daily


def resolve_zone(name: object) -> ZoneInfo:
	"""Resolve an IANA time zone name, falling back to UTC.

	The name reaches here from the browser, so an unknown or malformed one must degrade to a
	readable forecast rather than an error. ZoneInfo rejects absolute and traversing keys.
	"""
	text = str(name or "").strip()
	if not text or len(text) > 64:
		return UTC
	try:
		return ZoneInfo(text)
	except (ZoneInfoNotFoundError, ValueError):
		return UTC


def local_wall_clock(value: object, zone: ZoneInfo) -> str | None:
	"""Rewrite an ISO timestamp as the place's local wall clock, carrying no offset.

	Every time the tool publishes takes this shape, because the frontend reads the clock
	digits out of the string rather than reinterpreting them in the visitor's own zone.
	"""
	moment = _local_time(value, zone)
	return moment.strftime("%Y-%m-%dT%H:%M") if moment is not None else None


def apparent_temperature(temperature: float, humidity: object, wind_speed: object) -> float:
	"""Steadman's apparent temperature, the "feels like" reading MET does not publish.

	`wind_speed` is in metres per second, as MET reports it. Humidity and wind are optional in
	the payload, and each one simply drops out of the formula when it is missing.
	"""
	vapour_pressure = 0.0
	if isinstance(humidity, (int, float)) and not isinstance(humidity, bool):
		saturation = 6.105 * math.exp(17.27 * temperature / (237.7 + temperature))
		vapour_pressure = (float(humidity) / 100) * saturation
	wind = float(wind_speed) if isinstance(wind_speed, (int, float)) and not isinstance(wind_speed, bool) else 0.0
	return round(temperature + 0.33 * vapour_pressure - 0.70 * wind - 4.00, 1)


@dataclass(frozen=True)
class _Point:
	"""One Locationforecast instant, already in local time."""

	time: str
	date: str
	hour: int
	temperature: float
	humidity: float | None
	wind_speed: float | None
	wind_direction: float | None
	weather_code: int | None
	precipitation: float | None
	block_maximum: float | None
	block_minimum: float | None
	precipitation_probability: float | None

	@property
	def wind_speed_kmh(self) -> float | None:
		"""MET reports wind in m/s; the tool has always shown km/h."""
		return None if self.wind_speed is None else round(self.wind_speed * 3.6, 1)

	@property
	def within_one_day(self) -> bool:
		"""True when this point's six-hour block ends before local midnight.

		A block that straddles midnight would carry the next day's temperatures into today.
		"""
		return self.hour + 6 <= 24


def _build_current(point: _Point) -> dict[str, object]:
	"""Publish the first point as the current conditions; MET's series starts at this hour.

	The contract needs a condition and a wind speed on every reading, and only the very end of
	a series ever lacks them. The fallbacks below therefore describe the dullest reading MET
	could plausibly mean, rather than dropping a forecast a visitor asked for.
	"""
	return {
		"time": point.time,
		"temperature": point.temperature,
		"apparentTemperature": apparent_temperature(point.temperature, point.humidity, point.wind_speed),
		"weatherCode": point.weather_code if point.weather_code is not None else OVERCAST_CODE,
		"relativeHumidity": point.humidity,
		"windSpeed": point.wind_speed_kmh if point.wind_speed_kmh is not None else 0.0,
		"windDirection": point.wind_direction,
		"precipitation": point.precipitation,
	}


def _build_hourly(points: Sequence[_Point]) -> list[dict[str, object]]:
	return [
		{
			"time": point.time,
			"temperature": point.temperature,
			"weatherCode": point.weather_code,
			"precipitation": point.precipitation,
		}
		for point in points
		if point.weather_code is not None
	][:MAX_HOURLY_POINTS]


def _day_temperatures(day: Sequence[_Point]) -> list[float]:
	"""Every temperature the day can be judged by.

	The instants alone would miss the extremes between them, so each six-hour block that stays
	inside the day contributes its own maximum and minimum.
	"""
	values = [point.temperature for point in day]
	for point in day:
		if point.within_one_day:
			values.extend(value for value in (point.block_maximum, point.block_minimum) if value is not None)
	return values


def _day_weather_code(day: Sequence[_Point]) -> int:
	"""The day's most significant condition.

	WMO codes climb roughly with severity, so the highest code of the day is the one worth
	putting on a one-line summary. A day with no symbol at all is reported as overcast.
	"""
	codes = [point.weather_code for point in day if point.weather_code is not None]
	return max(codes) if codes else OVERCAST_CODE


def _day_precipitation_probability(day: Sequence[_Point]) -> float | None:
	"""MET models precipitation probability for the Nordic area only, so this is often absent."""
	values = [point.precipitation_probability for point in day if point.precipitation_probability is not None]
	return max(values) if values else None


def _parse_points(timeseries: Sequence[object], zone: ZoneInfo) -> list[_Point]:
	points = []
	for entry in timeseries[:MAX_TIMESERIES_POINTS]:
		point = _parse_point(entry, zone)
		if point is not None:
			points.append(point)
	return points


def _parse_point(entry: object, zone: ZoneInfo) -> _Point | None:
	if not isinstance(entry, Mapping):
		return None
	data = entry.get("data")
	if not isinstance(data, Mapping):
		return None
	instant = _details(data.get("instant"))
	temperature = _optional_number(instant.get("air_temperature"))
	local = _local_time(entry.get("time"), zone)
	if temperature is None or local is None:
		return None

	blocks = {name: data.get(name) for name in FORECAST_BLOCKS}
	hourly_block = _details(blocks.get("next_1_hours"))
	six_hour_block = _details(blocks.get("next_6_hours"))
	return _Point(
		time=local.strftime("%Y-%m-%dT%H:%M"),
		date=local.strftime("%Y-%m-%d"),
		hour=local.hour,
		temperature=temperature,
		humidity=_optional_number(instant.get("relative_humidity")),
		wind_speed=_optional_number(instant.get("wind_speed")),
		wind_direction=_optional_number(instant.get("wind_from_direction")),
		weather_code=_point_weather_code(blocks),
		# Only the one-hour block, so an hourly card never shows a six-hour total.
		precipitation=_optional_number(hourly_block.get("precipitation_amount")),
		block_maximum=_optional_number(six_hour_block.get("air_temperature_max")),
		block_minimum=_optional_number(six_hour_block.get("air_temperature_min")),
		precipitation_probability=_block_probability(blocks),
	)


def _point_weather_code(blocks: Mapping[str, object]) -> int | None:
	"""Take the shortest block that carries a symbol; the tail of the series has only longer ones."""
	for name in FORECAST_BLOCKS:
		code = wmo_code(_summary(blocks.get(name)).get("symbol_code"))
		if code is not None:
			return code
	return None


def _block_probability(blocks: Mapping[str, object]) -> float | None:
	for name in FORECAST_BLOCKS:
		value = _optional_number(_details(blocks.get(name)).get("probability_of_precipitation"))
		if value is not None:
			return value
	return None


def _timeseries(payload: object) -> Sequence[object]:
	if not isinstance(payload, Mapping):
		raise WeatherProviderError("The MET Norway response has an unexpected shape.")
	properties = payload.get("properties")
	timeseries = properties.get("timeseries") if isinstance(properties, Mapping) else None
	if not isinstance(timeseries, list) or not timeseries:
		raise WeatherProviderError("The MET Norway forecast is missing its timeseries.")
	return timeseries


def _local_time(value: object, zone: ZoneInfo) -> datetime | None:
	if not isinstance(value, str):
		return None
	try:
		moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
	except ValueError:
		return None
	if moment.tzinfo is None:
		moment = moment.replace(tzinfo=UTC)
	return moment.astimezone(zone)


def _details(block: object) -> Mapping[str, object]:
	return _child(block, "details")


def _summary(block: object) -> Mapping[str, object]:
	return _child(block, "summary")


def _child(block: object, key: str) -> Mapping[str, object]:
	if not isinstance(block, Mapping):
		return {}
	value = block.get(key)
	return value if isinstance(value, Mapping) else {}


def _optional_number(value: object) -> float | None:
	if isinstance(value, bool) or not isinstance(value, (int, float)):
		return None
	number = float(value)
	return number if math.isfinite(number) else None
