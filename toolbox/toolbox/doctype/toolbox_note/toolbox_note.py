# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from frappe.model.document import Document
from frappe.utils import sanitize_html, strip_html

from toolbox.permissions import has_owner_permission, owner_query_conditions


class ToolboxNote(Document):
	def validate(self):
		# Sanitize on the server on every save so stored HTML can never carry scripts,
		# event handlers, or unsafe embeds, regardless of any client-side cleaning.
		self.content_html = sanitize_html(self.content_html or "", always_sanitize=True)
		self.search_text = _plain_text(self.content_html)


def _plain_text(html: str) -> str:
	"""Return a whitespace-collapsed, tag-free index of the sanitized HTML for search."""
	return " ".join(strip_html(html or "").split())


# Registered in hooks.py so list/report queries only ever return the caller's own notes.
def get_permission_query_conditions(user=None):
	return owner_query_conditions("Toolbox Note", user)


# Registered in hooks.py so document-level access checks are owner-only.
def has_permission(doc, user=None, permission_type=None):
	return has_owner_permission(doc, user)
