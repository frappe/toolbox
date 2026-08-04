# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from toolbox.permissions import has_owner_permission, owner_query_conditions
from toolbox.reminder_schedule import REPEAT_TYPES, InvalidTimeZone, resolve_timezone

DOCTYPE = "Toolbox Reminder"

# Editing any of these re-arms the reminder from scratch; other saves (scheduler advance, snooze,
# complete) set next_trigger_at directly and must be left untouched.
SCHEDULE_FIELDS = (
	"local_date",
	"local_time",
	"time_zone",
	"repeat_type",
	"repeat_interval",
	"repeat_end_date",
)


class ToolboxReminder(Document):
	def validate(self):
		if not (self.title or "").strip():
			frappe.throw(_("A reminder needs a title."))
		try:
			resolve_timezone(self.time_zone)
		except InvalidTimeZone:
			frappe.throw(_("Choose a valid time zone."))
		if self.repeat_type not in REPEAT_TYPES:
			self.repeat_type = "None"
		self.repeat_interval = max(cint(self.repeat_interval) or 1, 1)

		if self.is_new() or any(self.has_value_changed(field) for field in SCHEDULE_FIELDS):
			# Imported here to keep the scheduling logic in one module; no import cycle at load.
			from toolbox.reminders import apply_schedule

			apply_schedule(self)


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
