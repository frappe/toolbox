# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.model.document import Document

from toolbox.permissions import has_full_access

# Regular users may read system templates but never modify them.
_WRITE_TYPES = frozenset({"write", "create", "delete", "cancel", "submit", "amend"})


class ToolboxChecklistTemplate(Document):
	def validate(self):
		for index, item in enumerate(self.items):
			item.sort_order = index


def get_permission_query_conditions(user: str | None = None) -> str:
	"""List access: system templates are visible to everyone, personal ones to their owner."""
	user = user or frappe.session.user
	if has_full_access(user):
		return ""
	table = "`tabToolbox Checklist Template`"
	return f"({table}.`scope` = 'System' OR {table}.`owner` = {frappe.db.escape(user)})"


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	"""System templates are read-only for regular users; personal templates are owner-only."""
	user = user or frappe.session.user
	if has_full_access(user):
		return True
	if getattr(doc, "scope", None) == "System":
		return permission_type not in _WRITE_TYPES
	return getattr(doc, "owner", None) == user
