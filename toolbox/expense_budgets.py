# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for monthly budgets and their progress against actual spend.

V1 covers one overall monthly budget plus optional per-category monthly budgets, all in a single
display currency. Progress is informational only — no advice, no automatic action.
"""

from calendar import monthrange
from collections import Counter
from datetime import date
from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, nowdate

from toolbox.expense_settings import BUDGET, CATEGORY, EXPENSE

OVERALL = "__overall__"


@frappe.whitelist()
@frappe.read_only()
def list_budgets(month: int | None = None, year: int | None = None) -> list[dict]:
	today = getdate(nowdate())
	month = cint(month) or today.month
	year = cint(year) or today.year
	rows = frappe.get_all(
		BUDGET,
		filters={"owner": frappe.session.user, "month": month, "year": year},
		fields=["name", "month", "year", "category", "currency", "budget_amount"],
	)
	for row in rows:
		row["budget_amount"] = flt(row["budget_amount"])
		row["category_name"] = (
			frappe.db.get_value(CATEGORY, row["category"], "category_name") if row.get("category") else None
		)
	return rows


@frappe.whitelist(methods=["POST"])
def set_budget(payload: str) -> dict:
	"""Create or update one monthly budget (overall when no category is given)."""
	data = _parse(payload)
	today = getdate(nowdate())
	year = cint(data.get("year")) or today.year
	month = cint(data.get("month")) or today.month
	if not 1 <= month <= 12:
		frappe.throw(_("Choose a valid month."))
	category = _owned_link(CATEGORY, data.get("category")) if data.get("category") else None
	amount = flt(data.get("budget_amount"))
	if amount <= 0:
		frappe.throw(_("Enter a budget amount greater than zero."))

	existing = frappe.get_all(
		BUDGET,
		filters={"owner": frappe.session.user, "year": year, "month": month, "category": category or ""},
		pluck="name",
	)
	doc = frappe.get_doc(BUDGET, existing[0]) if existing else frappe.new_doc(BUDGET)
	doc.period_type = "Monthly"
	doc.year = year
	doc.month = month
	doc.category = category
	doc.currency = (data.get("currency") or "").strip().upper() or None
	doc.budget_amount = amount
	doc.save()
	return {"name": doc.name, "year": year, "month": month, "category": category}


@frappe.whitelist(methods=["POST"])
def delete_budget(name: str) -> None:
	doc = frappe.get_doc(BUDGET, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this budget."))
	frappe.delete_doc(BUDGET, name)


@frappe.whitelist()
@frappe.read_only()
def budget_progress(month: int | None = None, year: int | None = None, currency: str | None = None) -> dict:
	"""Overall and per-category budget vs actual spend for a month, in one display currency."""
	today = getdate(nowdate())
	month = cint(month) or today.month
	year = cint(year) or today.year
	currency = (currency or _busiest_currency() or "INR").upper()

	start, end = date(year, month, 1), date(year, month, monthrange(year, month)[1])
	actual_by_category, overall_actual = _actuals(start, end, currency)
	budgets = {(b["category"] or OVERALL): b for b in list_budgets(month, year)}

	categories = [
		_progress_row(budget, actual_by_category.get(key, Decimal("0")))
		for key, budget in budgets.items()
		if key != OVERALL
	]
	overall_budget = budgets.get(OVERALL)
	return {
		"currency": currency,
		"month": month,
		"year": year,
		"overall": _progress_row(overall_budget, overall_actual) if overall_budget else None,
		"overall_spent": float(overall_actual),
		"categories": sorted(categories, key=lambda row: row["spent"], reverse=True),
	}


def _actuals(start: date, end: date, currency: str) -> tuple[dict[str, Decimal], Decimal]:
	totals: dict[str, Decimal] = {}
	overall = Decimal("0")
	for row in frappe.get_all(
		EXPENSE,
		filters={
			"owner": frappe.session.user,
			"currency": currency,
			"expense_date": ["between", [str(start), str(end)]],
		},
		fields=["amount", "category"],
		limit=0,
	):
		amount = Decimal(str(row["amount"] or 0))
		overall += amount
		totals[row["category"]] = totals.get(row["category"], Decimal("0")) + amount
	return totals, overall


def _progress_row(budget: dict, spent: Decimal) -> dict:
	amount = Decimal(str(budget["budget_amount"]))
	return {
		"category": budget.get("category"),
		"category_name": budget.get("category_name"),
		"budget": float(amount),
		"spent": float(spent),
		"remaining": float(amount - spent),
		"pct": float(spent / amount * 100) if amount > 0 else None,
	}


def _busiest_currency() -> str | None:
	currencies = frappe.get_all(EXPENSE, filters={"owner": frappe.session.user}, pluck="currency", limit=0)
	return Counter(currencies).most_common(1)[0][0] if currencies else None


def _owned_link(doctype: str, name: object) -> str | None:
	if not name:
		return None
	doc = frappe.get_doc(doctype, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to use this record."))
	return name


def _parse(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid payload."))
	return data
