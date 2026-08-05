# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Owner-enforced API for expense Trips and Projects and their spending summary."""

from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import cint, flt

from toolbox.expense_settings import CATEGORY, EXPENSE, PROJECT

PROJECT_TYPES = ("Trip", "Project")
PROJECT_STATUSES = ("Active", "Completed", "Archived")
MAX_NAME = 140


@frappe.whitelist()
@frappe.read_only()
def list_projects(include_archived: int = 0) -> list[dict]:
	filters = {"owner": frappe.session.user}
	if not cint(include_archived):
		filters["status"] = ["!=", "Archived"]
	rows = frappe.get_all(
		PROJECT,
		filters=filters,
		fields=["name", "project_name", "project_type", "status", "start_date", "end_date",
			"default_currency", "budget", "note"],
		order_by="status asc, modified desc",
	)
	for row in rows:
		row["budget"] = flt(row["budget"]) if row.get("budget") else None
		for key in ("start_date", "end_date"):
			row[key] = str(row[key]) if row.get(key) else None
	return rows


@frappe.whitelist(methods=["POST"])
def save_project(payload: str) -> dict:
	data = _parse(payload)
	doc = _owned(data.get("name")) if data.get("name") else frappe.new_doc(PROJECT)
	name = (data.get("project_name") or "").strip()[:MAX_NAME]
	if not name:
		frappe.throw(_("Give the trip or project a name."))
	doc.project_name = name
	doc.project_type = data.get("project_type") if data.get("project_type") in PROJECT_TYPES else "Trip"
	doc.status = data.get("status") if data.get("status") in PROJECT_STATUSES else "Active"
	doc.start_date = data.get("start_date") or None
	doc.end_date = data.get("end_date") or None
	doc.default_currency = (data.get("default_currency") or "").strip().upper() or None
	doc.budget = flt(data.get("budget")) or None
	doc.note = (data.get("note") or "").strip() or None
	doc.save()
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def delete_project(name: str) -> None:
	_owned(name)
	try:
		frappe.delete_doc(PROJECT, name)
	except frappe.LinkExistsError:
		frappe.throw(_("This trip has expenses. Set its status to Archived instead."))


@frappe.whitelist()
@frappe.read_only()
def project_summary(name: str) -> dict:
	"""Totals, budget progress, and category breakdown for one trip/project.

	Totals are in the project's default currency; expenses in other currencies are listed
	separately rather than mixed into one meaningless sum.
	"""
	project = _owned(name)
	rows = frappe.get_all(
		EXPENSE,
		filters={"owner": frappe.session.user, "project_or_trip": name},
		fields=["amount", "currency", "category"],
		limit=0,
	)
	base = (project.default_currency or "").upper() or _dominant_currency(rows)
	by_currency: dict[str, Decimal] = {}
	category_totals: dict[str, Decimal] = {}
	for row in rows:
		currency = (row["currency"] or "").upper()
		by_currency[currency] = by_currency.get(currency, Decimal("0")) + Decimal(str(row["amount"] or 0))
		if currency == base:
			label = frappe.db.get_value(CATEGORY, row["category"], "category_name") or _("Uncategorised")
			category_totals[label] = category_totals.get(label, Decimal("0")) + Decimal(str(row["amount"] or 0))

	total = by_currency.get(base, Decimal("0"))
	budget = Decimal(str(project.budget)) if project.budget else None
	return {
		"name": project.name,
		"project_name": project.project_name,
		"base_currency": base,
		"total_spent": float(total),
		"budget": float(budget) if budget is not None else None,
		"budget_remaining": float(budget - total) if budget is not None else None,
		"expense_count": len(rows),
		"currencies": [{"currency": c, "total": float(v)} for c, v in sorted(by_currency.items())],
		"category_breakdown": [
			{"label": label, "amount": float(amount)}
			for label, amount in sorted(category_totals.items(), key=lambda kv: kv[1], reverse=True)
		],
	}


def _dominant_currency(rows: list[dict]) -> str:
	from collections import Counter

	currencies = [(row["currency"] or "").upper() for row in rows if row.get("currency")]
	return Counter(currencies).most_common(1)[0][0] if currencies else "INR"


def _serialize(doc) -> dict:
	return {
		"name": doc.name,
		"project_name": doc.project_name,
		"project_type": doc.project_type,
		"status": doc.status,
		"start_date": str(doc.start_date) if doc.start_date else None,
		"end_date": str(doc.end_date) if doc.end_date else None,
		"default_currency": doc.default_currency,
		"budget": flt(doc.budget) if doc.budget else None,
		"note": doc.note,
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Trip or project not found."))
	doc = frappe.get_doc(PROJECT, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this trip or project."))
	return doc


def _parse(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid payload."))
	return data
