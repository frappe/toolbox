# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe import _
from frappe.model.document import Document

from toolbox.expense_categorizer import validate_pattern
from toolbox.permissions import has_owner_permission, owner_query_conditions

DOCTYPE = "Toolbox Expense Rule"


class ToolboxExpenseRule(Document):
	def validate(self):
		try:
			validate_pattern(self.match_type, self.pattern)
		except ValueError as exc:
			frappe.throw(str(exc))


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
