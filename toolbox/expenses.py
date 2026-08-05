# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for Personal Expenses: entry, categorisation, listing, and the dashboard.

Every method runs as the logged-in user and only ever reads or writes that user's own records.
Money is summed with ``Decimal`` so 2-decimal amounts never drift. Categorisation is fully
deterministic (see ``expense_categorizer``); no remote service is ever called.
"""

from calendar import monthrange
from collections import Counter
from datetime import date
from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, nowdate

from toolbox.expense_categorizer import categorize, normalise
from toolbox.expense_settings import (
	CATEGORY,
	EXPENSE,
	PAYMENT_METHOD,
	RULE,
	ensure_defaults,
	list_categories,
	list_payment_methods,
)

MAX_TEXT = 200
MAX_PAGE = 200
DEFAULT_PAGE = 50
PRIOR_LOOKBACK = 200


@frappe.whitelist()
@frappe.read_only()
def setup() -> dict:
	"""Seed defaults on first use and return the pickers the entry form needs."""
	ensure_defaults()
	return {"categories": list_categories(), "payment_methods": list_payment_methods()}


@frappe.whitelist()
@frappe.read_only()
def suggest_category(merchant: str = "", description: str = "") -> dict:
	"""Deterministically suggest a category for a merchant/description. Never auto-applied."""
	user = frappe.session.user
	rules = [
		_rule_dict(row)
		for row in frappe.get_all(
			RULE, filters={"owner": user, "is_active": 1}, fields=["*"], order_by="priority asc"
		)
	]
	suggestion = categorize(merchant, description, rules, _prior_choices(user))
	return _resolve_suggestion(suggestion)


@frappe.whitelist(methods=["POST"])
def save_expense(payload: str) -> dict:
	data = _parse(payload)
	doc = _owned(data.get("name")) if data.get("name") else frappe.new_doc(EXPENSE)
	_apply(doc, data)
	doc.save()
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def delete_expense(name: str) -> None:
	_owned(name)
	frappe.delete_doc(EXPENSE, name)


@frappe.whitelist()
@frappe.read_only()
def list_expenses(filters: str | None = None, limit: int = DEFAULT_PAGE, start: int = 0) -> dict:
	"""Return a filtered, paginated page of the user's expenses plus the total match count."""
	criteria = _parse(filters) if filters else {}
	conditions, or_conditions = _build_filters(criteria)
	limit = min(max(cint(limit) or DEFAULT_PAGE, 1), MAX_PAGE)
	names = frappe.get_all(
		EXPENSE,
		filters=conditions,
		or_filters=or_conditions,
		order_by=_order_by(criteria.get("sort")),
		limit=limit,
		limit_start=max(cint(start), 0),
		pluck="name",
	)
	total = frappe.db.count(EXPENSE, conditions) if not or_conditions else _count_with_or(conditions, or_conditions)
	return {
		"expenses": [_serialize(frappe.get_doc(EXPENSE, name)) for name in names],
		"total": total,
		"start": max(cint(start), 0),
		"limit": limit,
	}


@frappe.whitelist(methods=["POST"])
def learn_rule(merchant: str, category: str) -> dict | None:
	"""Create or update an exact-merchant rule from a user's category choice (spec 11.9)."""
	merchant = (merchant or "").strip()
	category = _owned_category(category)
	if not merchant:
		return None
	existing = frappe.get_all(
		RULE,
		filters={"owner": frappe.session.user, "match_field": "merchant", "match_type": "exact"},
		fields=["name", "pattern"],
	)
	target = next((r["name"] for r in existing if normalise(r["pattern"]) == normalise(merchant)), None)
	doc = frappe.get_doc(RULE, target) if target else frappe.new_doc(RULE)
	category_name = frappe.db.get_value(CATEGORY, category, "category_name")
	doc.update(
		{
			"rule_name": _("{0} → {1}").format(merchant, category_name),
			"match_field": "merchant",
			"match_type": "exact",
			"pattern": merchant,
			"category": category,
			"priority": 10,
			"is_active": 1,
		}
	)
	doc.save()
	return {"name": doc.name, "category": category}


@frappe.whitelist()
@frappe.read_only()
def dashboard(month: int | None = None, year: int | None = None, currency: str | None = None) -> dict:
	"""Monthly summary in one display currency; other-currency expenses are counted, not summed."""
	today = getdate(nowdate())
	month = cint(month) or today.month
	year = cint(year) or today.year
	currency = (currency or _busiest_currency() or "INR").upper()

	this_start, this_end = _month_bounds(year, month)
	prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
	prev_start, prev_end = _month_bounds(prev_year, prev_month)

	this_rows = _expenses_between(this_start, this_end, currency)
	spend_this = _sum(row["amount"] for row in this_rows)
	spend_last = _sum(
		row["amount"] for row in _expenses_between(prev_start, prev_end, currency)
	)

	return {
		"currency": currency,
		"month": month,
		"year": year,
		"spend_this_month": float(spend_this),
		"spend_last_month": float(spend_last),
		"change_pct": _change_pct(spend_this, spend_last),
		"category_breakdown": _breakdown(this_rows, "category_name"),
		"top_merchants": _breakdown(this_rows, "merchant", limit=5, skip_blank=True),
		"expense_count": len(this_rows),
		"other_currency_count": _other_currency_count(this_start, this_end, currency),
		"recent": [_serialize(frappe.get_doc(EXPENSE, r["name"])) for r in _recent()],
	}


# --- apply / serialize ----------------------------------------------------------------------


def _apply(doc, data: dict) -> None:
	doc.expense_date = data.get("expense_date") or nowdate()
	doc.amount = flt(data.get("amount"))
	doc.currency = (data.get("currency") or "").strip().upper()
	doc.description = _truncate((data.get("description") or "").strip(), MAX_TEXT)
	if not doc.description:
		frappe.throw(_("Add a short description."))
	doc.merchant = _truncate((data.get("merchant") or "").strip(), MAX_TEXT) or None
	doc.category = _owned_category(data.get("category"))
	doc.payment_method = _owned_link(PAYMENT_METHOD, data.get("payment_method"))
	doc.account_label = (data.get("account_label") or "").strip() or None
	doc.reference_number = (data.get("reference_number") or "").strip() or None
	doc.note = (data.get("note") or "").strip() or None
	doc.tags = _join_tags(data.get("tags"))
	doc.categorisation_rule = (data.get("categorisation_rule") or "").strip() or None
	doc.base_currency = (data.get("base_currency") or "").strip().upper() or None
	doc.conversion_rate = flt(data.get("conversion_rate")) or None
	doc.conversion_rate_date = data.get("conversion_rate_date") or None
	doc.conversion_source = (data.get("conversion_source") or "").strip() or None


def _serialize(doc) -> dict:
	return {
		"name": doc.name,
		"expense_date": str(doc.expense_date) if doc.expense_date else None,
		"amount": flt(doc.amount),
		"currency": doc.currency,
		"description": doc.description,
		"merchant": doc.merchant,
		"category": doc.category,
		"category_name": _name_of(CATEGORY, doc.category, "category_name"),
		"payment_method": doc.payment_method,
		"payment_method_name": _name_of(PAYMENT_METHOD, doc.payment_method, "method_name"),
		"account_label": doc.account_label,
		"reference_number": doc.reference_number,
		"note": doc.note,
		"tags": _split_tags(doc.tags),
		"base_currency": doc.base_currency,
		"conversion_rate": doc.conversion_rate,
		"conversion_rate_date": str(doc.conversion_rate_date) if doc.conversion_rate_date else None,
		"conversion_source": doc.conversion_source,
		"base_amount": flt(doc.base_amount) if doc.base_amount else None,
		"modified": str(doc.modified),
	}


# --- filters / dashboard helpers ------------------------------------------------------------


def _build_filters(criteria: dict) -> tuple[dict, list]:
	conditions: dict = {"owner": frappe.session.user}
	for key, field in (("category", "category"), ("payment_method", "payment_method"), ("currency", "currency")):
		if criteria.get(key):
			conditions[field] = criteria[key]
	if criteria.get("from_date"):
		conditions["expense_date"] = [">=", criteria["from_date"]]
	if criteria.get("to_date"):
		conditions["expense_date"] = ["<=", criteria["to_date"]]
	if criteria.get("from_date") and criteria.get("to_date"):
		conditions["expense_date"] = ["between", [criteria["from_date"], criteria["to_date"]]]

	or_conditions: list = []
	search = (criteria.get("search") or "").strip()
	if search:
		like = f"%{search}%"
		or_conditions = [
			["description", "like", like],
			["merchant", "like", like],
			["note", "like", like],
			["reference_number", "like", like],
			["tags", "like", like],
		]
	return conditions, or_conditions


def _count_with_or(conditions: dict, or_conditions: list) -> int:
	return len(
		frappe.get_all(EXPENSE, filters=conditions, or_filters=or_conditions, pluck="name", limit=0)
	)


def _order_by(sort: str | None) -> str:
	return {
		"amount_desc": "amount desc",
		"amount_asc": "amount asc",
		"date_asc": "expense_date asc, creation asc",
	}.get(sort, "expense_date desc, creation desc")


def _prior_choices(user: str) -> dict[str, str]:
	"""Most recent confirmed category per normalised merchant, from recent expenses."""
	choices: dict[str, str] = {}
	for row in frappe.get_all(
		EXPENSE,
		filters={"owner": user},
		fields=["merchant", "category"],
		order_by="modified desc",
		limit=PRIOR_LOOKBACK,
	):
		key = normalise(row.get("merchant"))
		if key and key not in choices and row.get("category"):
			choices[key] = row["category"]
	return choices


def _expenses_between(start: date, end: date, currency: str) -> list[dict]:
	return frappe.get_all(
		EXPENSE,
		filters={
			"owner": frappe.session.user,
			"currency": currency,
			"expense_date": ["between", [str(start), str(end)]],
		},
		fields=["name", "amount", "merchant", "category"],
		limit=0,
	) or []


def _breakdown(rows: list[dict], key: str, limit: int | None = None, skip_blank: bool = False) -> list[dict]:
	totals: dict[str, Decimal] = {}
	for row in rows:
		label = row["category"] if key == "category_name" else row.get("merchant")
		label = _name_of(CATEGORY, label, "category_name") if key == "category_name" else label
		if skip_blank and not label:
			continue
		label = label or _("Uncategorised")
		totals[label] = totals.get(label, Decimal("0")) + Decimal(str(row["amount"] or 0))
	ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
	if limit:
		ranked = ranked[:limit]
	return [{"label": label, "amount": float(amount)} for label, amount in ranked]


def _other_currency_count(start: date, end: date, currency: str) -> int:
	return frappe.db.count(
		EXPENSE,
		{
			"owner": frappe.session.user,
			"currency": ["!=", currency],
			"expense_date": ["between", [str(start), str(end)]],
		},
	)


def _recent() -> list[dict]:
	return frappe.get_all(
		EXPENSE,
		filters={"owner": frappe.session.user},
		fields=["name"],
		order_by="expense_date desc, creation desc",
		limit=5,
	)


def _busiest_currency() -> str | None:
	"""The currency the user records most often, used as the dashboard's default display currency.

	Counted in Python: Frappe 17 rejects SQL-function strings (e.g. ``count(name)``) in get_all
	fields, and the per-user row count is small.
	"""
	currencies = frappe.get_all(
		EXPENSE, filters={"owner": frappe.session.user}, pluck="currency", limit=0
	)
	return Counter(currencies).most_common(1)[0][0] if currencies else None


def _resolve_suggestion(suggestion: dict) -> dict:
	value = suggestion.get("category")
	category_id, category_name = _resolve_category(value) if value else (None, None)
	return {
		"category": category_id,
		"category_name": category_name,
		"confidence": suggestion.get("confidence"),
		"explanation": suggestion.get("explanation"),
		"rule_name": suggestion.get("rule_name"),
		"payment_method": suggestion.get("payment_method"),
	}


def _resolve_category(value: str) -> tuple[str | None, str | None]:
	"""A suggestion carries either a category id (from a rule/prior choice) or a name (built-in)."""
	user = frappe.session.user
	if frappe.db.exists(CATEGORY, {"name": value, "owner": user, "is_archived": 0}):
		return value, frappe.db.get_value(CATEGORY, value, "category_name")
	match = frappe.get_all(
		CATEGORY, filters={"owner": user, "category_name": value, "is_archived": 0}, pluck="name"
	)
	return (match[0], value) if match else (None, None)


# --- small shared utilities -----------------------------------------------------------------


def _month_bounds(year: int, month: int) -> tuple[date, date]:
	return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def _sum(values) -> Decimal:
	total = Decimal("0")
	for value in values:
		total += Decimal(str(value or 0))
	return total


def _change_pct(current: Decimal, previous: Decimal) -> float | None:
	if previous == 0:
		return None
	return float((current - previous) / previous * 100)


def _rule_dict(row: dict) -> dict:
	return {
		"name": row.get("name"),
		"rule_name": row.get("rule_name"),
		"priority": row.get("priority"),
		"match_field": row.get("match_field"),
		"match_type": row.get("match_type"),
		"pattern": row.get("pattern"),
		"category": row.get("category"),
		"payment_method": row.get("payment_method"),
		"tags": row.get("tags"),
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Expense not found."))
	doc = frappe.get_doc(EXPENSE, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this expense."))
	return doc


def _owned_category(name: object) -> str:
	if not name:
		frappe.throw(_("Choose a category."))
	return _owned_link(CATEGORY, name)


def _owned_link(doctype: str, name: object) -> str | None:
	if not name:
		return None
	doc = frappe.get_doc(doctype, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to use this record."))
	return name


def _name_of(doctype: str, name: str | None, field: str) -> str | None:
	return frappe.db.get_value(doctype, name, field) if name else None


def _split_tags(value) -> list[str]:
	return [tag.strip() for tag in value.split(",") if tag.strip()] if value else []


def _join_tags(value) -> str | None:
	if not value:
		return None
	tags = _split_tags(value) if isinstance(value, str) else [str(tag).strip() for tag in value]
	seen: set[str] = set()
	unique: list[str] = []
	for tag in tags:
		key = tag.lower()
		if tag and key not in seen:
			seen.add(key)
			unique.append(tag)
	return ", ".join(unique) or None


def _truncate(text: str, limit: int) -> str:
	return text if len(text) <= limit else text[:limit]


def _parse(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid payload."))
	return data
