# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from frappe.model.document import Document
from frappe.utils import now_datetime


class ToolboxChecklist(Document):
	def validate(self):
		self._normalize_items()

	def _normalize_items(self):
		# Persist the current display order and keep completion timestamps consistent.
		for index, item in enumerate(self.items):
			item.sort_order = index
			if item.is_completed and not item.completed_at:
				item.completed_at = now_datetime()
			elif not item.is_completed:
				item.completed_at = None
