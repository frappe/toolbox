# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for Expenses configuration: categories, payment methods, and rules.

Each user gets their own private copies of the default categories and payment methods on first
use (seeded lazily), so there is no shared master to keep in sync and everything is owner-scoped
like the rest of Phase 2.
"""

import frappe
from frappe import _
from frappe.utils import cint

from toolbox.expense_categorizer import MATCH_FIELDS, MATCH_TYPES, validate_pattern

CATEGORY = "Toolbox Expense Category"
PAYMENT_METHOD = "Toolbox Payment Method"
RULE = "Toolbox Expense Rule"
EXPENSE = "Toolbox Expense"

DEFAULT_CATEGORIES = (
	"Food and Dining", "Groceries", "Transport", "Travel", "Accommodation", "Shopping",
	"Utilities", "Housing", "Health", "Education", "Entertainment", "Personal Care",
	"Subscriptions", "Gifts", "Fees", "Other",
)
DEFAULT_PAYMENT_METHODS = ("Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer", "Wallet", "Other")

MAX_NAME = 100


def ensure_defaults() -> None:
	"""Seed this user's default categories and payment methods once. Idempotent."""
	user = frappe.session.user
	if not frappe.db.exists(CATEGORY, {"owner": user}):
		for index, name in enumerate(DEFAULT_CATEGORIES):
			_insert(CATEGORY, {"category_name": name, "sort_order": index, "is_system_default": 1})
	if not frappe.db.exists(PAYMENT_METHOD, {"owner": user}):
		for index, name in enumerate(DEFAULT_PAYMENT_METHODS):
			_insert(PAYMENT_METHOD, {"method_name": name, "sort_order": index, "is_system_default": 1})


# --- Categories -----------------------------------------------------------------------------


@frappe.whitelist()
@frappe.read_only()
def list_categories(include_archived: int = 0) -> list[dict]:
	return _list(CATEGORY, "category_name", cint(include_archived))


@frappe.whitelist(methods=["POST"])
def save_category(payload: str) -> dict:
	data = _parse(payload)
	doc = _owned(CATEGORY, data.get("name")) if data.get("name") else frappe.new_doc(CATEGORY)
	name = _clean_name(data.get("category_name"))
	if not name:
		frappe.throw(_("Give the category a name."))
	doc.category_name = name
	doc.icon = (data.get("icon") or "").strip() or None
	if data.get("sort_order") is not None:
		doc.sort_order = cint(data.get("sort_order"))
	doc.is_archived = 1 if data.get("is_archived") else 0
	doc.save()
	return _serialize_named(doc, "category_name")


@frappe.whitelist(methods=["POST"])
def delete_category(name: str) -> None:
	_delete_or_advise(CATEGORY, name, _("This category is used by expenses. Archive it instead."))


# --- Payment methods ------------------------------------------------------------------------


@frappe.whitelist()
@frappe.read_only()
def list_payment_methods(include_archived: int = 0) -> list[dict]:
	return _list(PAYMENT_METHOD, "method_name", cint(include_archived))


@frappe.whitelist(methods=["POST"])
def save_payment_method(payload: str) -> dict:
	data = _parse(payload)
	doc = _owned(PAYMENT_METHOD, data.get("name")) if data.get("name") else frappe.new_doc(PAYMENT_METHOD)
	name = _clean_name(data.get("method_name"))
	if not name:
		frappe.throw(_("Give the payment method a name."))
	doc.method_name = name
	if data.get("sort_order") is not None:
		doc.sort_order = cint(data.get("sort_order"))
	doc.is_archived = 1 if data.get("is_archived") else 0
	doc.save()
	return _serialize_named(doc, "method_name")


@frappe.whitelist(methods=["POST"])
def delete_payment_method(name: str) -> None:
	_delete_or_advise(PAYMENT_METHOD, name, _("This payment method is used by expenses. Archive it instead."))


# --- Rules ----------------------------------------------------------------------------------


@frappe.whitelist()
@frappe.read_only()
def list_rules() -> list[dict]:
	rows = frappe.get_all(
		RULE, filters={"owner": frappe.session.user}, order_by="priority asc, modified desc", pluck="name"
	)
	return [serialize_rule(frappe.get_doc(RULE, name)) for name in rows]


@frappe.whitelist(methods=["POST"])
def save_rule(payload: str) -> dict:
	data = _parse(payload)
	doc = _owned(RULE, data.get("name")) if data.get("name") else frappe.new_doc(RULE)
	doc.rule_name = _clean_name(data.get("rule_name")) or _("Untitled rule")
	doc.match_field = data.get("match_field") if data.get("match_field") in MATCH_FIELDS else "combined"
	doc.match_type = data.get("match_type") if data.get("match_type") in MATCH_TYPES else "contains"
	doc.pattern = (data.get("pattern") or "").strip()
	try:
		validate_pattern(doc.match_type, doc.pattern)
	except ValueError as exc:
		frappe.throw(str(exc))
	doc.category = _owned_link(CATEGORY, data.get("category"), _("Choose a category for the rule."))
	doc.payment_method = _owned_link(PAYMENT_METHOD, data.get("payment_method")) if data.get("payment_method") else None
	doc.tags = (data.get("tags") or "").strip() or None
	doc.priority = cint(data.get("priority"))
	doc.is_active = 0 if data.get("is_active") is False else 1
	doc.stop_processing = 1 if data.get("stop_processing") else 0
	doc.save()
	return serialize_rule(doc)


@frappe.whitelist(methods=["POST"])
def delete_rule(name: str) -> None:
	_owned(RULE, name)
	frappe.delete_doc(RULE, name)


# --- Shared helpers -------------------------------------------------------------------------


def serialize_rule(doc) -> dict:
	return {
		"name": doc.name,
		"rule_name": doc.rule_name,
		"is_active": bool(doc.is_active),
		"priority": doc.priority,
		"match_field": doc.match_field,
		"match_type": doc.match_type,
		"pattern": doc.pattern,
		"category": doc.category,
		"category_name": _name_of(CATEGORY, doc.category, "category_name"),
		"payment_method": doc.payment_method,
		"payment_method_name": _name_of(PAYMENT_METHOD, doc.payment_method, "method_name"),
		"tags": doc.tags,
		"stop_processing": bool(doc.stop_processing),
	}


def _list(doctype: str, name_field: str, include_archived: int) -> list[dict]:
	filters = {"owner": frappe.session.user}
	if not include_archived:
		filters["is_archived"] = 0
	rows = frappe.get_all(
		doctype,
		filters=filters,
		fields=["name", name_field, "sort_order", "is_archived", "is_system_default"],
		order_by="sort_order asc, " + name_field + " asc",
	)
	for row in rows:
		row["is_archived"] = bool(row["is_archived"])
		row["is_system_default"] = bool(row["is_system_default"])
	return rows


def _serialize_named(doc, name_field: str) -> dict:
	return {
		"name": doc.name,
		name_field: doc.get(name_field),
		"sort_order": doc.sort_order,
		"is_archived": bool(doc.is_archived),
		"is_system_default": bool(doc.is_system_default),
	}


def _delete_or_advise(doctype: str, name: str, advice: str) -> None:
	_owned(doctype, name)
	try:
		frappe.delete_doc(doctype, name)
	except frappe.LinkExistsError:
		frappe.throw(advice)


def _insert(doctype: str, values: dict) -> None:
	frappe.get_doc({"doctype": doctype, **values}).insert()


def _owned(doctype: str, name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Record not found."))
	doc = frappe.get_doc(doctype, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this record."))
	return doc


def _owned_link(doctype: str, name: object, error: str | None = None) -> str | None:
	if not name:
		if error:
			frappe.throw(error)
		return None
	_owned(doctype, name)
	return name


def _name_of(doctype: str, name: str | None, field: str) -> str | None:
	return frappe.db.get_value(doctype, name, field) if name else None


def _clean_name(value: object) -> str:
	text = (value or "").strip() if isinstance(value, str) else ""
	return text[:MAX_NAME]


def _parse(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid payload."))
	return data
