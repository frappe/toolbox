# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""Historical ECB reference-rate series for the Currency Converter rate chart.

Data honesty: every point is a real dated ECB reference rate. Series are built from the
ECB SDMX data API, querying only the two currencies and the date range the chart needs, and
cross-rates are derived from the published per-EUR rates. Nothing is synthesized.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Callable

import frappe
import requests
from frappe import _
from frappe.rate_limiter import rate_limit
from redis.exceptions import LockError

from toolbox.provider_errors import provider_unavailable

# Query only the two spot currencies vs EUR at daily frequency, as CSV.
ECB_DATA_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.{keys}.EUR.SP00.A"
ECB_SOURCE_URL = (
	"https://www.ecb.europa.eu/stats/policy_and_exchange_rates/"
	"euro_reference_exchange_rates/html/index.en.html"
)
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_SERIES_POINTS = 500
CACHE_PREFIX = "currency:ecb:history:v1"
LOCK_KEY = "currency:ecb:history-lock:v1"
CACHE_TTL_SECONDS = 6 * 60 * 60

# The ECB publishes reference rates for this fixed set of currencies (plus EUR itself).
SUPPORTED_CURRENCIES = frozenset(
	{
		"EUR", "USD", "JPY", "BGN", "CZK", "DKK", "GBP", "HUF", "PLN", "RON",
		"SEK", "CHF", "ISK", "NOK", "TRY", "AUD", "BRL", "CAD", "CNY", "HKD",
		"IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR",
	}
)

# Approximate calendar span per range; None means "since the ECB series began (1999)".
RANGE_DAYS: dict[str, int | None] = {
	"1M": 31,
	"6M": 184,
	"1Y": 366,
	"5Y": 5 * 366,
	"MAX": None,
}
ECB_SERIES_START = date(1999, 1, 4)


class CurrencyHistoryError(Exception):
	pass


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=30, seconds=60)
def get_rate_history(base: str, quote: str, range: str = "1Y") -> dict[str, object]:
	"""Return a real dated ECB rate-over-time series for base -> quote."""
	return CurrencyHistoryService().get(base, quote, range)


class EcbHistoricalRateProvider:
	def __init__(self, session: object = requests) -> None:
		self.session = session

	def fetch(self, currencies: list[str], start: date) -> dict[str, dict[str, float]]:
		"""Return {currency: {isoDate: perEurRate}} for the requested non-EUR currencies."""
		if not currencies:
			return {}

		keys = "+".join(sorted(currencies))
		url = ECB_DATA_URL.format(keys=keys)
		params = {"startPeriod": start.isoformat(), "format": "csvdata"}
		headers = {
			"Accept": "text/csv",
			"User-Agent": "Frappe-Toolbox/1.0 (+https://frappe.io)",
		}
		try:
			response = self.session.get(url, params=params, headers=headers, timeout=(3.05, 20))
		except requests.RequestException as error:
			raise CurrencyHistoryError("The ECB historical-rate feed is unavailable.") from error

		if response.status_code != 200:
			raise CurrencyHistoryError("The ECB historical-rate feed returned an unexpected status.")
		if len(response.content) > MAX_RESPONSE_BYTES:
			raise CurrencyHistoryError("The ECB historical-rate response is too large.")

		return parse_ecb_history_csv(response.text, set(currencies))


def parse_ecb_history_csv(text: str, expected: set[str]) -> dict[str, dict[str, float]]:
	observations: dict[str, dict[str, float]] = {code: {} for code in expected}
	reader = csv.reader(io.StringIO(text))
	try:
		header = next(reader)
	except StopIteration as error:
		raise CurrencyHistoryError("The ECB historical-rate response is empty.") from error

	try:
		currency_index = header.index("CURRENCY")
		date_index = header.index("TIME_PERIOD")
		value_index = header.index("OBS_VALUE")
	except ValueError as error:
		raise CurrencyHistoryError("The ECB historical-rate response is missing columns.") from error

	for row in reader:
		if len(row) <= max(currency_index, date_index, value_index):
			continue
		currency = row[currency_index]
		if currency not in observations:
			continue
		iso_date = _parse_iso_date(row[date_index])
		rate = _parse_rate(row[value_index])
		if iso_date is None or rate is None:
			continue
		observations[currency][iso_date] = rate

	return observations


class CurrencyHistoryService:
	def __init__(
		self,
		provider: EcbHistoricalRateProvider | None = None,
		cache: object | None = None,
		clock: Callable[[], datetime] | None = None,
	) -> None:
		self.provider = provider or EcbHistoricalRateProvider()
		self.cache = cache or frappe.cache
		self.clock = clock or (lambda: datetime.now(timezone.utc))

	def get(self, base: str, quote: str, range_key: str) -> dict[str, object]:
		base = _validate_currency(base)
		quote = _validate_currency(quote)
		range_key = _validate_range(range_key)

		cache_key = f"{CACHE_PREFIX}:{base}:{quote}:{range_key}"
		cached = self.cache.get_value(cache_key, expires=True, use_local_cache=False)
		if cached:
			return cached

		lock_name = self.cache.make_key(LOCK_KEY) if hasattr(self.cache, "make_key") else LOCK_KEY
		try:
			with self.cache.lock(lock_name, timeout=25, blocking_timeout=8):
				cached = self.cache.get_value(cache_key, expires=True, use_local_cache=False)
				if cached:
					return cached
				response = self._build(base, quote, range_key)
				self.cache.set_value(cache_key, response, expires_in_sec=CACHE_TTL_SECONDS)
				return response
		except LockError as error:
			raise provider_unavailable(
				_("Historical rates are temporarily unavailable. Please try again later."),
				provider="European Central Bank (history lock)",
				cause=error,
			) from None

	def _build(self, base: str, quote: str, range_key: str) -> dict[str, object]:
		start = self._start_date(range_key)
		wanted = [code for code in {base, quote} if code != "EUR"]
		try:
			observations = self.provider.fetch(wanted, start)
		except CurrencyHistoryError as error:
			raise provider_unavailable(
				_("Historical rates are temporarily unavailable. Please try again later."),
				provider="European Central Bank (history)",
				cause=error,
			) from None

		points = _cross_rate_series(base, quote, observations)
		if len(points) < 2:
			raise CurrencyHistoryError(
				f"The ECB does not publish enough history for {base} to {quote}."
			)
		points = _downsample(points, MAX_SERIES_POINTS)

		return {
			"schemaVersion": 1,
			"base": base,
			"quote": quote,
			"range": range_key,
			"points": points,
			"observationCount": len(points),
			"source": {
				"name": "European Central Bank",
				"url": ECB_SOURCE_URL,
				"attribution": "Source: ECB statistics.",
			},
			"referenceRateNotice": (
				"ECB reference rates are for information only and are not transaction rates."
			),
		}

	def _start_date(self, range_key: str) -> date:
		days = RANGE_DAYS[range_key]
		if days is None:
			return ECB_SERIES_START
		return self.clock().date() - timedelta(days=days)


def _cross_rate_series(
	base: str, quote: str, observations: dict[str, dict[str, float]]
) -> list[dict[str, object]]:
	base_rates = {} if base == "EUR" else observations.get(base, {})
	quote_rates = {} if quote == "EUR" else observations.get(quote, {})

	if base == "EUR" and quote == "EUR":
		dates: list[str] = []
	elif base == "EUR":
		dates = sorted(quote_rates)
	elif quote == "EUR":
		dates = sorted(base_rates)
	else:
		dates = sorted(set(base_rates) & set(quote_rates))

	points: list[dict[str, object]] = []
	for iso_date in dates:
		base_per_eur = 1.0 if base == "EUR" else base_rates[iso_date]
		quote_per_eur = 1.0 if quote == "EUR" else quote_rates[iso_date]
		if base_per_eur <= 0:
			continue
		# 1 base = (quote_per_eur / base_per_eur) quote.
		points.append({"date": iso_date, "value": round(quote_per_eur / base_per_eur, 8)})
	return points


def _downsample(points: list[dict[str, object]], limit: int) -> list[dict[str, object]]:
	if len(points) <= limit:
		return points
	# Even stride, always keeping the first and last observation.
	step = (len(points) - 1) / (limit - 1)
	indexes = sorted({round(index * step) for index in range(limit)})
	indexes = [min(index, len(points) - 1) for index in indexes]
	if indexes[-1] != len(points) - 1:
		indexes.append(len(points) - 1)
	return [points[index] for index in indexes]


def _validate_currency(code: object) -> str:
	if not isinstance(code, str):
		raise CurrencyHistoryError("A currency code must be provided.")
	code = code.strip().upper()
	if code not in SUPPORTED_CURRENCIES:
		raise CurrencyHistoryError(f"{code!r} is not an ECB reference currency.")
	return code


def _validate_range(range_key: object) -> str:
	if not isinstance(range_key, str) or range_key.upper() not in RANGE_DAYS:
		raise CurrencyHistoryError("An unsupported chart range was requested.")
	return range_key.upper()


def _parse_iso_date(value: str) -> str | None:
	try:
		return date.fromisoformat(value.strip()).isoformat()
	except (ValueError, AttributeError):
		return None


def _parse_rate(value: str) -> float | None:
	try:
		rate = Decimal(value)
	except (InvalidOperation, TypeError):
		return None
	if not rate.is_finite() or rate <= 0 or rate > Decimal("100000000"):
		return None
	return float(rate)
