# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""MET Norway weather client.

MET Norway publishes the same CC BY 4.0 forecast data Toolbox used before, and without the
non-commercial service term that made the previous provider unusable on a public site. Its
terms ask for two things, and both are met here: an identifying `User-Agent` carrying a
contact address, and well under twenty requests a second.

Two MET services are involved. Locationforecast 2.0 gives the forecast. Sunrise 3.0 gives
sunrise and sunset, one date per call, so those answers are cached for a month — the sun
over a fixed coordinate on a fixed date does not change — and the whole set is abandoned
once a time budget runs out rather than holding a visitor while MET is slow.
"""

from __future__ import annotations

import json
from time import monotonic
from zoneinfo import ZoneInfo

import frappe
import requests

from toolbox.weather_forecast import Forecast, WeatherProviderError, local_wall_clock, resolve_zone

FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete"
SUNRISE_URL = "https://api.met.no/weatherapi/sunrise/3.0/sun"
USER_AGENT = "Frappe-Toolbox/1.0 (https://frappe.tools; support@frappe.io)"
MAX_RESPONSE_BYTES = 256 * 1024
FORECAST_TIMEOUT = (3.05, 10)
SUNRISE_TIMEOUT = (3.05, 5)
# A cold coordinate needs one lookup per day shown. Past this the remaining days go without,
# which costs one line of the interface instead of the whole forecast.
SUNRISE_BUDGET_SECONDS = 8
SUNRISE_CACHE_KEY = "weather:sun:v1:"
SUNRISE_TTL_SECONDS = 30 * 24 * 60 * 60


class MetNoProvider:
	def __init__(self, session: object = requests, cache: object | None = None) -> None:
		self.session = session
		self.cache = cache if cache is not None else frappe.cache

	def forecast(self, latitude: float, longitude: float, timezone: str) -> dict[str, object]:
		zone = resolve_zone(timezone)
		payload = _load_payload(self._fetch(FORECAST_URL, _place(latitude, longitude), FORECAST_TIMEOUT))
		forecast = Forecast(payload, zone, latitude, longitude)
		return forecast.to_payload(self._sun_times(latitude, longitude, forecast.dates, zone))

	def _sun_times(
		self, latitude: float, longitude: float, dates: list[str], zone: ZoneInfo
	) -> dict[str, dict[str, str | None]]:
		deadline = monotonic() + SUNRISE_BUDGET_SECONDS
		sun_times = {}
		for date in dates:
			cache_key = f"{SUNRISE_CACHE_KEY}{latitude}:{longitude}:{date}:{zone}"
			cached = self.cache.get_value(cache_key, expires=True, use_local_cache=False)
			if cached:
				sun_times[date] = cached
				continue
			if monotonic() >= deadline:
				break
			times = self._fetch_sun_times(latitude, longitude, date, zone)
			self.cache.set_value(cache_key, times, expires_in_sec=SUNRISE_TTL_SECONDS)
			sun_times[date] = times
		return sun_times

	def _fetch_sun_times(
		self, latitude: float, longitude: float, date: str, zone: ZoneInfo
	) -> dict[str, str | None]:
		"""Read one date's sun times, or report none.

		Above the Arctic and Antarctic circles MET answers with a null time, because the sun
		neither rises nor sets that day. That is data, not a failure, and it reaches the
		interface as a missing line.
		"""
		params = {**_place(latitude, longitude), "date": date}
		try:
			payload = _load_payload(self._fetch(SUNRISE_URL, params, SUNRISE_TIMEOUT))
		except WeatherProviderError:
			return {"sunrise": None, "sunset": None}
		properties = payload.get("properties")
		if not isinstance(properties, dict):
			return {"sunrise": None, "sunset": None}
		return {name: _local_sun_time(properties.get(name), zone) for name in ("sunrise", "sunset")}

	def _fetch(self, url: str, params: dict[str, object], timeout: tuple[float, float]) -> bytes:
		headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
		try:
			response = self.session.get(url, params=params, headers=headers, timeout=timeout)
		except requests.RequestException as error:
			raise WeatherProviderError("The MET Norway service is unavailable.") from error

		if response.status_code != 200:
			raise WeatherProviderError("The MET Norway service returned an unexpected status.")
		if len(response.content) > MAX_RESPONSE_BYTES:
			raise WeatherProviderError("The MET Norway response is too large.")
		return response.content


def _place(latitude: float, longitude: float) -> dict[str, object]:
	# MET asks callers to send no more precision than they need, so that its cache can work.
	return {"lat": round(float(latitude), 4), "lon": round(float(longitude), 4)}


def _local_sun_time(value: object, zone: ZoneInfo) -> str | None:
	"""Rewrite one sun time as the place's local wall clock, matching every other time sent."""
	if not isinstance(value, dict):
		return None
	return local_wall_clock(value.get("time"), zone)


def _load_payload(content: bytes) -> dict[str, object]:
	try:
		payload = json.loads(content)
	except (ValueError, TypeError) as error:
		raise WeatherProviderError("The MET Norway response is not valid JSON.") from error
	if not isinstance(payload, dict):
		raise WeatherProviderError("The MET Norway response has an unexpected shape.")
	return payload
