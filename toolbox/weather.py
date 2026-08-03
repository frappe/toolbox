# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

import math
from copy import deepcopy
from datetime import datetime, timezone
from typing import Callable

import frappe
from frappe import _
from frappe.exceptions import ServiceUnavailableError
from frappe.rate_limiter import rate_limit
from redis.exceptions import LockError

from toolbox.weather_provider import OpenMeteoProvider, WeatherProviderError

FORECAST_CACHE_KEY = "weather:forecast:v1:"
FORECAST_LOCK_KEY = "weather:forecast:refresh-lock:v1:"
GEOCODE_CACHE_KEY = "weather:geocode:v1:"
FORECAST_FRESH_SECONDS = 20 * 60
FORECAST_STALE_SECONDS = 6 * 60 * 60
GEOCODE_TTL_SECONDS = 30 * 24 * 60 * 60
QUERY_MIN_LENGTH = 2
QUERY_MAX_LENGTH = 80
FORECAST_NOTICE = "Weather forecasts are for general information only and may be delayed or inaccurate."


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=30, seconds=60)
def search_locations(query: str) -> dict[str, object]:
	"""Return matching places for a name. User input is validated and never trusted downstream."""
	return LocationSearchService().search(query)


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=60, seconds=60)
def get_forecast(latitude: float, longitude: float, timezone: str | None = None) -> dict[str, object]:
	"""Return a cached public forecast for a coordinate. No user account data is involved."""
	latitude, longitude = _validate_coordinates(latitude, longitude)
	return WeatherForecastService(latitude, longitude, timezone).get()


class LocationSearchService:
	def __init__(
		self,
		provider: OpenMeteoProvider | None = None,
		cache: object | None = None,
	) -> None:
		self.provider = provider or OpenMeteoProvider()
		self.cache = cache or frappe.cache

	def search(self, query: str) -> dict[str, object]:
		name = _validate_query(query)
		cache_key = f"{GEOCODE_CACHE_KEY}{name.casefold()}"
		cached = self.cache.get_value(cache_key, expires=True, use_local_cache=False)
		if cached:
			return deepcopy(cached)

		try:
			result = self.provider.geocode(name)
		except WeatherProviderError:
			raise ServiceUnavailableError(
				_("Location search is temporarily unavailable. Please try again later.")
			) from None

		self.cache.set_value(cache_key, result, expires_in_sec=GEOCODE_TTL_SECONDS)
		return deepcopy(result)


class WeatherForecastService:
	def __init__(
		self,
		latitude: float,
		longitude: float,
		tz: str | None = None,
		provider: OpenMeteoProvider | None = None,
		cache: object | None = None,
		clock: Callable[[], datetime] | None = None,
	) -> None:
		self.latitude = round(float(latitude), 2)
		self.longitude = round(float(longitude), 2)
		self.tz = str(tz).strip() if tz else "auto"
		self.provider = provider or OpenMeteoProvider()
		self.cache = cache or frappe.cache
		self.clock = clock or (lambda: datetime.now(timezone.utc))
		self.cache_key = f"{FORECAST_CACHE_KEY}{self.latitude}:{self.longitude}"
		self.lock_key = f"{FORECAST_LOCK_KEY}{self.latitude}:{self.longitude}"

	def get(self) -> dict[str, object]:
		cached = self._get_cached()
		if cached and self._is_fresh(cached):
			return self._public_response(cached, "cached")

		lock_name = self.cache.make_key(self.lock_key) if hasattr(self.cache, "make_key") else self.lock_key
		try:
			with self.cache.lock(lock_name, timeout=15, blocking_timeout=5):
				cached = self._get_cached()
				if cached and self._is_fresh(cached):
					return self._public_response(cached, "cached")
				return self._refresh(cached)
		except LockError:
			cached = self._get_cached()
			if cached:
				return self._public_response(cached, "stale")
			raise ServiceUnavailableError(
				_("Weather forecasts are temporarily unavailable. Please try again later.")
			) from None

	def _refresh(self, cached: dict[str, object] | None) -> dict[str, object]:
		try:
			data = self.provider.forecast(self.latitude, self.longitude, self.tz)
		except WeatherProviderError:
			if cached:
				return self._public_response(cached, "stale")
			raise ServiceUnavailableError(
				_("Weather forecasts are temporarily unavailable. Please try again later.")
			) from None

		stored = {
			**data,
			"providerCheckedAt": self.clock().isoformat(),
			# Internal request context; stripped from the public payload (mirrors currency.py).
			"validators": {"latitude": self.latitude, "longitude": self.longitude, "timezone": self.tz},
		}
		self._store(stored)
		return self._public_response(stored, "live")

	def _get_cached(self) -> dict[str, object] | None:
		return self.cache.get_value(self.cache_key, expires=True, use_local_cache=False)

	def _store(self, value: dict[str, object]) -> None:
		self.cache.set_value(self.cache_key, value, expires_in_sec=FORECAST_STALE_SECONDS)

	def _is_fresh(self, value: dict[str, object]) -> bool:
		try:
			checked_at = datetime.fromisoformat(str(value["providerCheckedAt"]))
		except (KeyError, TypeError, ValueError):
			return False
		if checked_at.tzinfo is None:
			return False
		return (self.clock() - checked_at).total_seconds() < FORECAST_FRESH_SECONDS

	@staticmethod
	def _public_response(value: dict[str, object], cache_status: str) -> dict[str, object]:
		response = deepcopy(value)
		response.pop("validators", None)
		response["cacheStatus"] = cache_status
		response["forecastNotice"] = FORECAST_NOTICE
		return response


def _validate_coordinates(latitude: object, longitude: object) -> tuple[float, float]:
	try:
		lat = float(latitude)
		lon = float(longitude)
	except (TypeError, ValueError):
		frappe.throw(_("Provide a valid latitude and longitude."))
	if not math.isfinite(lat) or not math.isfinite(lon):
		frappe.throw(_("Provide a valid latitude and longitude."))
	if lat < -90 or lat > 90:
		frappe.throw(_("Latitude must be between -90 and 90 degrees."))
	if lon < -180 or lon > 180:
		frappe.throw(_("Longitude must be between -180 and 180 degrees."))
	return lat, lon


def _validate_query(query: str) -> str:
	text = " ".join(str(query or "").strip().split())
	if len(text) < QUERY_MIN_LENGTH or len(text) > QUERY_MAX_LENGTH:
		frappe.throw(_("Enter between 2 and 80 characters."))
	return text
