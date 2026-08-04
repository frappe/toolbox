# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe import _
from frappe.model.document import Document

from toolbox.library import STATUSES, domain_of, normalise_url
from toolbox.permissions import has_owner_permission, owner_query_conditions

DOCTYPE = "Toolbox Saved Link"


class ToolboxSavedLink(Document):
	def validate(self):
		if not (self.url or "").strip():
			frappe.throw(_("Enter a URL to save."))
		# The normalised URL and domain are derived from the raw URL so duplicate detection and
		# filtering stay consistent whether a link is saved through the API or the desk.
		self.normalised_url = normalise_url(self.url)
		self.domain = domain_of(self.normalised_url)
		if self.status not in STATUSES:
			self.status = "Inbox"


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
