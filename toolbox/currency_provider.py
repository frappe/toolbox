# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree

import requests

ECB_FEED_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
ECB_SOURCE_URL = (
	"https://www.ecb.europa.eu/stats/policy_and_exchange_rates/"
	"euro_reference_exchange_rates/html/index.en.html"
)
MAX_RESPONSE_BYTES = 128 * 1024
MINIMUM_RATE_COUNT = 20
REQUIRED_CURRENCIES = frozenset({"EUR", "USD", "GBP", "INR", "SGD"})
_CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")


class CurrencyProviderError(Exception):
	pass


class EcbReferenceRateProvider:
	def __init__(self, session: object = requests) -> None:
		self.session = session

	def fetch(self, validators: dict[str, str] | None = None) -> dict[str, object]:
		headers = {
			"Accept": "application/xml,text/xml",
			"User-Agent": "Frappe-Toolbox/1.0 (+https://frappe.io)",
		}
		validators = validators or {}
		if validators.get("etag"):
			headers["If-None-Match"] = validators["etag"]
		if validators.get("lastModified"):
			headers["If-Modified-Since"] = validators["lastModified"]

		try:
			response = self.session.get(ECB_FEED_URL, headers=headers, timeout=(3.05, 10))
		except requests.RequestException as error:
			raise CurrencyProviderError("The ECB reference-rate feed is unavailable.") from error

		if response.status_code == 304:
			return {"notModified": True, "validators": validators}
		if response.status_code != 200:
			raise CurrencyProviderError("The ECB reference-rate feed returned an unexpected status.")
		if len(response.content) > MAX_RESPONSE_BYTES:
			raise CurrencyProviderError("The ECB reference-rate response is too large.")

		data = parse_ecb_reference_rates(response.content)
		return {
			"notModified": False,
			"data": data,
			"validators": {
				"etag": response.headers.get("ETag", ""),
				"lastModified": response.headers.get("Last-Modified", ""),
			},
		}


def parse_ecb_reference_rates(content: bytes) -> dict[str, object]:
	try:
		root = ElementTree.fromstring(content)
	except ElementTree.ParseError as error:
		raise CurrencyProviderError("The ECB reference-rate response is not valid XML.") from error

	rate_date: str | None = None
	rates: dict[str, float] = {"EUR": 1.0}
	for element in root.iter():
		attributes = element.attrib
		if "time" in attributes:
			rate_date = _parse_rate_date(attributes["time"])
		currency = attributes.get("currency")
		rate = attributes.get("rate")
		if currency is None and rate is None:
			continue
		if not currency or not rate or not _CURRENCY_CODE.fullmatch(currency):
			raise CurrencyProviderError("The ECB reference-rate response contains an invalid currency.")
		if currency in rates:
			raise CurrencyProviderError("The ECB reference-rate response contains a duplicate currency.")
		rates[currency] = _parse_rate(rate)

	if not rate_date or len(rates) < MINIMUM_RATE_COUNT or not REQUIRED_CURRENCIES.issubset(rates):
		raise CurrencyProviderError("The ECB reference-rate response is incomplete.")
	return {
		"schemaVersion": 1,
		"baseCurrency": "EUR",
		"rateDate": rate_date,
		"rates": dict(sorted(rates.items())),
		"source": {
			"name": "European Central Bank",
			"url": ECB_SOURCE_URL,
			"attribution": "Source: ECB statistics.",
		},
	}


def _parse_rate_date(value: str) -> str:
	try:
		return date.fromisoformat(value).isoformat()
	except ValueError as error:
		raise CurrencyProviderError("The ECB reference-rate response has an invalid date.") from error


def _parse_rate(value: str) -> float:
	try:
		rate = Decimal(value)
	except InvalidOperation as error:
		raise CurrencyProviderError("The ECB reference-rate response contains an invalid rate.") from error
	if not rate.is_finite() or rate <= 0 or rate > Decimal("1000000000"):
		raise CurrencyProviderError("The ECB reference-rate response contains an invalid rate.")
	return float(rate)
