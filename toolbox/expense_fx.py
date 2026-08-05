# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Optional live base-currency conversion for expenses, via the existing Currency Converter.

The ECB reference rates are EUR-based, so a cross rate is ``(EUR→to) / (EUR→from)``. This only
*suggests* a rate to pre-fill on entry; the manual rate stays the default and stored expenses are
never rewritten (spec §11.8, §13.4). ``cross_rate`` is pure and unit-tested; the endpoint reads
the cached rates through the Currency Converter, which remains the owner of provider logic.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit


def cross_rate(rates: dict, base_currency: str, from_currency: str, to_currency: str) -> float | None:
	"""Rate to convert 1 unit of ``from_currency`` into ``to_currency`` using EUR-based rates."""
	base = (base_currency or "EUR").upper()

	def eur_rate(currency: str) -> float | None:
		if currency == base:
			return 1.0
		value = rates.get(currency)
		try:
			return float(value) if value else None
		except (TypeError, ValueError):
			return None

	from_rate = eur_rate(from_currency.upper())
	to_rate = eur_rate(to_currency.upper())
	if not from_rate or not to_rate:
		return None
	return to_rate / from_rate


@frappe.whitelist()
@frappe.read_only()
@rate_limit(limit=30, seconds=60)
def suggest_conversion_rate(from_currency: str, to_currency: str) -> dict:
	"""Suggest a reference conversion rate. Returns ``{ok: False, error}`` if unavailable."""
	from_ccy = (from_currency or "").strip().upper()
	to_ccy = (to_currency or "").strip().upper()
	if not from_ccy or not to_ccy:
		return {"ok": False, "error": _("Choose both currencies.")}
	if from_ccy == to_ccy:
		return {"ok": True, "rate": 1.0, "date": None, "source": "ecb-reference"}

	from toolbox.currency import CurrencyRateService

	try:
		data = CurrencyRateService().get()
	except Exception:
		return {"ok": False, "error": _("Reference rates are unavailable right now.")}

	rate = cross_rate(data.get("rates", {}), data.get("baseCurrency", "EUR"), from_ccy, to_ccy)
	if not rate:
		return {"ok": False, "error": _("No reference rate for {0} to {1}.").format(from_ccy, to_ccy)}
	return {"ok": True, "rate": round(rate, 6), "date": data.get("rateDate"), "source": "ecb-reference"}
