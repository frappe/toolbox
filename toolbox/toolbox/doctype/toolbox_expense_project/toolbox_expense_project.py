# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from frappe.model.document import Document

from toolbox.permissions import has_owner_permission, owner_query_conditions

DOCTYPE = "Toolbox Expense Project"


class ToolboxExpenseProject(Document):
	pass


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
