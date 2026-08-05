# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import re
from decimal import Decimal, InvalidOperation

import frappe
from frappe import _
from frappe.model.document import Document

from toolbox.permissions import has_owner_permission, owner_query_conditions

DOCTYPE = "Toolbox Expense"
_CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")


class ToolboxExpense(Document):
	def validate(self):
		self.currency = (self.currency or "").strip().upper()
		if not _CURRENCY_CODE.fullmatch(self.currency):
			frappe.throw(_("Enter a three-letter currency code, e.g. INR or USD."))
		if not self.amount or float(self.amount) <= 0:
			frappe.throw(_("Enter an amount greater than zero."))

		self.merchant = (self.merchant or "").strip() or None
		self._apply_base_conversion()

	def _apply_base_conversion(self):
		"""Derive the base amount from the stored rate. A missing rate leaves it unconverted,
		so a mixed-currency ledger stays honest rather than inventing a total."""
		self.base_currency = (self.base_currency or "").strip().upper() or None
		if self.base_currency and self.conversion_rate:
			try:
				self.base_amount = float(Decimal(str(self.amount)) * Decimal(str(self.conversion_rate)))
			except (InvalidOperation, ValueError):
				frappe.throw(_("The conversion rate is not a valid number."))
		else:
			self.base_amount = None
			self.conversion_rate = None
			self.conversion_rate_date = None
			self.conversion_source = None


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
