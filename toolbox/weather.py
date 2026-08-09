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
from frappe.query_builder import Order
from frappe.rate_limiter import rate_limit
from redis.exceptions import LockError

from toolbox.city_data import ALIAS_DOCTYPE, CITY_DOCTYPE
from toolbox.city_data import DATASET_TYPE as CITY_DATASET_TYPE
from toolbox.city_names import search_name
from toolbox.india_business_data import RELEASE_DOCTYPE
from toolbox.weather_forecast import WeatherProviderError
from toolbox.weather_provider import MetNoProvider

FORECAST_CACHE_KEY = "weather:forecast:v1:"
FORECAST_LOCK_KEY = "weather:forecast:refresh-lock:v1:"
FORECAST_FRESH_SECONDS = 20 * 60
FORECAST_STALE_SECONDS = 6 * 60 * 60
QUERY_MIN_LENGTH = 2
QUERY_MAX_LENGTH = 80
MAX_LOCATION_RESULTS = 10
FORECAST_NOTICE = "Weather forecasts are for general information only and may be delayed or inaccurate."
CITY_FIELDS = (
	"geoname_id",
	"city_name",
	"latitude",
	"longitude",
	"country",
	"country_code",
	"admin1",
	"timezone",
	"population",
)


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=30, seconds=60)
@frappe.read_only()
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
	"""City search over the bundled GeoNames release.

	The tool used to geocode through a third party. It now reads local reference data, so a
	search costs one indexed query, works offline, and sends nothing about a visitor anywhere.
	"""

	def __init__(self, limit: int = MAX_LOCATION_RESULTS) -> None:
		self.limit = limit

	def search(self, query: str) -> dict[str, object]:
		term = search_name(_validate_query(query))
		release = _active_release()
		if not release:
			return {"schemaVersion": 1, "results": [], "source": None}

		rows = self._matches(term, release.name)
		return {
			"schemaVersion": 1,
			"results": [_normalize_location(row) for row in rows],
			"source": _source(release),
		}

	def _matches(self, term: str, release_name: str) -> list[dict[str, object]]:
		"""Cities whose own name or local name starts with the term, then, only if neither
		does, cities whose name merely contains it.

		Both prefix passes are indexed. The contained pass is not — a leading wildcard reads
		every row of the release, half a millisecond against sixty — so it runs last and only
		when nothing else answered. It still reaches Las Vegas from "vegas".
		"""
		rows = self._merge(
			self._query(term, release_name, prefix=True),
			self._alias_query(term, release_name),
		)
		return rows or self._query(term, release_name, prefix=False)

	def _merge(self, *results: list[dict[str, object]]) -> list[dict[str, object]]:
		"""One row per city, most populous first, however many ways it was matched."""
		best: dict[int, dict[str, object]] = {}
		for rows in results:
			for row in rows:
				best.setdefault(row["geoname_id"], row)
		ranked = sorted(best.values(), key=lambda row: row["population"], reverse=True)
		return ranked[: self.limit]

	def _query(self, term: str, release_name: str, prefix: bool) -> list[dict[str, object]]:
		record = frappe.qb.DocType(CITY_DOCTYPE)
		pattern = f"{_escape(term)}%" if prefix else f"%{_escape(term)}%"
		return (
			frappe.qb.from_(record)
			.select(*(getattr(record, field) for field in CITY_FIELDS))
			.where(record.dataset_release == release_name)
			.where(record.search_name.like(pattern))
			.orderby(record.population, order=Order.desc)
			.limit(self.limit)
			.run(as_dict=True)
		)

	def _alias_query(self, term: str, release_name: str) -> list[dict[str, object]]:
		"""Cities reached through a name they are known by locally, such as "Roma" for Rome.

		Distinct, because a short prefix can match several of one city's names — "mo" matches
		both "moskva" and "moskau" — and a limit filled with one city is a limit wasted.
		"""
		record = frappe.qb.DocType(CITY_DOCTYPE)
		alias = frappe.qb.DocType(ALIAS_DOCTYPE)
		return (
			frappe.qb.from_(alias)
			.join(record)
			.on(alias.city == record.name)
			.distinct()
			.select(*(getattr(record, field) for field in CITY_FIELDS))
			.where(alias.dataset_release == release_name)
			.where(alias.search_name.like(f"{_escape(term)}%"))
			.orderby(record.population, order=Order.desc)
			.limit(self.limit)
			.run(as_dict=True)
		)


class WeatherForecastService:
	def __init__(
		self,
		latitude: float,
		longitude: float,
		tz: str | None = None,
		provider: MetNoProvider | None = None,
		cache: object | None = None,
		clock: Callable[[], datetime] | None = None,
	) -> None:
		self.latitude = round(float(latitude), 2)
		self.longitude = round(float(longitude), 2)
		self.tz = str(tz).strip() if tz else ""
		self.provider = provider or MetNoProvider()
		self.cache = cache or frappe.cache
		self.clock = clock or (lambda: datetime.now(timezone.utc))
		# Every published time is the place's local wall clock, so the zone is part of the
		# identity of a cached forecast, not just of the request that produced it.
		place = f"{self.latitude}:{self.longitude}:{self.tz}"
		self.cache_key = f"{FORECAST_CACHE_KEY}{place}"
		self.lock_key = f"{FORECAST_LOCK_KEY}{place}"

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


def _normalize_location(row: dict[str, object]) -> dict[str, object]:
	"""The shape the Weather tool's frontend has always received for a place."""
	return {
		"id": row["geoname_id"],
		"name": row["city_name"],
		"latitude": row["latitude"],
		"longitude": row["longitude"],
		"country": row["country"] or None,
		"countryCode": row["country_code"] or None,
		"admin1": row["admin1"] or None,
		"timezone": row["timezone"] or None,
		"population": row["population"],
	}


def _source(release) -> dict[str, str]:
	return {
		"name": release.source_name,
		"url": release.source_url,
		"license_name": release.license_name,
		"license_url": release.license_url,
		"attribution": release.attribution,
	}


def _active_release():
	return frappe.db.get_value(
		RELEASE_DOCTYPE,
		{"dataset_type": CITY_DATASET_TYPE, "status": "Active"},
		["name", "version", "source_name", "source_url", "license_name", "license_url", "attribution"],
		as_dict=True,
	)


def _escape(value: str) -> str:
	return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
