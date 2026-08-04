# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Reminders: owner-enforced API plus the server scheduler that is the source of truth.

Reminders are never driven by a browser timer. The Frappe scheduler (see ``run_due_reminders``,
wired in hooks.py) evaluates due reminders, records deliveries idempotently, and advances each
recurrence in its own named time zone. The recurrence and DST math lives in the dependency-free
``reminder_schedule`` module so it can be unit-tested with controlled time.

Datetimes are computed as timezone-aware UTC instants and stored in the site's system time zone,
matching how Frappe reads and writes datetimes, so ``next_trigger_at`` compares directly against
``frappe.utils.now_datetime()``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import frappe
from frappe import _
from frappe.utils import cint, get_datetime, get_system_timezone, get_time, getdate, now_datetime

from toolbox import reminder_schedule as schedule
from toolbox.reminder_schedule import REPEAT_TYPES, InvalidTimeZone

REMINDER = "Toolbox Reminder"
DELIVERY = "Toolbox Reminder Delivery"

STATUS_SCHEDULED = "Scheduled"
STATUS_COMPLETED = "Completed"
STATUS_CANCELLED = "Cancelled"

CHANNEL_IN_APP = "In-App"
CHANNEL_EMAIL = "Email"

MAX_TITLE = 200
MAX_NOTE = 2000
MAX_TAG_LENGTH = 50
MAX_TAGS = 25

# Preset snooze offsets in minutes. "tomorrow" and "custom" are handled separately.
SNOOZE_MINUTES = {"10m": 10, "30m": 30, "1h": 60}

# A save that touches any of these re-arms the reminder; other saves (scheduler advance, snooze,
# complete) set next_trigger_at directly and must not be recomputed.
SCHEDULE_FIELDS = (
	"local_date",
	"local_time",
	"time_zone",
	"repeat_type",
	"repeat_interval",
	"repeat_end_date",
)


# --- Time bridge between aware-UTC math and Frappe's system-timezone storage ----------------


def _system_tz() -> ZoneInfo:
	return ZoneInfo(get_system_timezone())


def _now_utc() -> datetime:
	return now_datetime().replace(tzinfo=_system_tz()).astimezone(timezone.utc)


def _to_storage(instant_utc: datetime | None) -> datetime | None:
	"""Aware-UTC instant to a naive system-timezone datetime for storage/comparison."""
	if instant_utc is None:
		return None
	return instant_utc.astimezone(_system_tz()).replace(tzinfo=None)


def _from_storage(stored: object) -> datetime | None:
	"""Stored system-timezone datetime back to an aware-UTC instant."""
	if not stored:
		return None
	return get_datetime(stored).replace(tzinfo=_system_tz()).astimezone(timezone.utc)


# --- Scheduling (called by the DocType controller on create / schedule change) --------------


def apply_schedule(doc) -> None:
	"""Recompute ``next_trigger_at`` from the reminder's schedule fields and re-arm it.

	Called from ``ToolboxReminder.validate`` only when the reminder is new or a schedule field
	changed, so scheduler advances, snoozes and completions that set the trigger directly are
	preserved.
	"""
	instant = schedule.first_trigger(
		getdate(doc.local_date),
		get_time(doc.local_time),
		doc.time_zone,
		doc.repeat_type,
		max(cint(doc.repeat_interval) or 1, 1),
		_now_utc(),
		getdate(doc.repeat_end_date) if doc.repeat_end_date else None,
	)
	doc.next_trigger_at = _to_storage(instant)
	doc.snoozed_until = None
	# A recurrence whose only occurrences are already past its end date has nothing to fire.
	doc.status = STATUS_SCHEDULED if instant else STATUS_COMPLETED


# --- Scheduler (source of truth; wired to a 5-minute cron in hooks.py) ----------------------


def run_due_reminders(now: datetime | None = None) -> None:
	"""Fire every scheduled reminder whose next trigger is due. One transaction per reminder."""
	now = now or _now_utc()
	due = frappe.get_all(
		REMINDER,
		filters=[
			["status", "=", STATUS_SCHEDULED],
			["next_trigger_at", "is", "set"],
			["next_trigger_at", "<=", _to_storage(now)],
		],
		pluck="name",
	)
	for name in due:
		try:
			_fire(frappe.get_doc(REMINDER, name), now)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			frappe.log_error(title=f"Reminder delivery failed: {name}")


def _fire(reminder, now: datetime) -> None:
	"""Deliver the due occurrence on each enabled channel, then advance or complete."""
	if reminder.status != STATUS_SCHEDULED or not reminder.next_trigger_at:
		return
	occurrence = _from_storage(reminder.next_trigger_at)

	if reminder.delivery_in_app:
		_record_delivery(reminder, occurrence, CHANNEL_IN_APP, now)
	if reminder.delivery_email:
		_record_delivery(reminder, occurrence, CHANNEL_EMAIL, now)

	reminder.last_triggered_at = _to_storage(now)
	reminder.snoozed_until = None
	nxt = schedule.next_trigger(
		getdate(reminder.local_date),
		get_time(reminder.local_time),
		reminder.time_zone,
		reminder.repeat_type,
		max(cint(reminder.repeat_interval) or 1, 1),
		after=occurrence,
		not_before=now,
		repeat_end_date=getdate(reminder.repeat_end_date) if reminder.repeat_end_date else None,
	)
	if nxt:
		reminder.next_trigger_at = _to_storage(nxt)
	else:
		reminder.next_trigger_at = None
		reminder.status = STATUS_COMPLETED
	reminder.save(ignore_permissions=True)


def _record_delivery(reminder, occurrence: datetime, channel: str, now: datetime) -> None:
	"""Idempotently deliver one occurrence on one channel.

	The unique ``idempotency_key`` is the hard guarantee that a fire is never duplicated, even if
	two workers race or the scheduler re-processes an occurrence. Email failures are recorded and
	swallowed so they never roll back a successful in-app delivery.
	"""
	key = f"{reminder.name}|{occurrence.isoformat()}|{channel}"
	if frappe.db.exists(DELIVERY, {"idempotency_key": key}):
		return
	delivery = frappe.get_doc(
		{
			"doctype": DELIVERY,
			"reminder": reminder.name,
			"reminder_title": reminder.title,
			"scheduled_for": _to_storage(occurrence),
			"channel": channel,
			"idempotency_key": key,
			"status": "Pending",
		}
	)
	delivery.owner = reminder.owner
	try:
		delivery.insert(ignore_permissions=True)
	except (frappe.UniqueValidationError, frappe.exceptions.DuplicateEntryError):
		return  # A concurrent worker claimed this occurrence first (unique idempotency_key).

	if channel == CHANNEL_EMAIL:
		try:
			_send_email(reminder)
		except Exception as exc:
			delivery.status = "Failed"
			delivery.error_summary = str(exc)[:140]
			delivery.save(ignore_permissions=True)
			return
	delivery.status = "Delivered"
	delivery.delivered_at = _to_storage(now)
	delivery.save(ignore_permissions=True)


def _send_email(reminder) -> None:
	if "@" not in (reminder.owner or ""):
		raise ValueError("Owner has no email address")
	frappe.sendmail(
		recipients=[reminder.owner],
		subject=_("Reminder: {0}").format(reminder.title),
		message=frappe.utils.escape_html(reminder.note or reminder.title),
		reference_doctype=REMINDER,
		reference_name=reminder.name,
	)


# --- Owner-enforced API ---------------------------------------------------------------------


@frappe.whitelist(methods=["POST"])
def save_reminder(payload: str) -> dict:
	data = frappe.parse_json(payload)
	if not isinstance(data, dict):
		frappe.throw(_("Invalid reminder payload."))
	name = data.get("name")
	doc = _owned(name) if name else frappe.new_doc(REMINDER)
	_apply(doc, data)
	doc.save()
	return _serialize(doc)


@frappe.whitelist()
@frappe.read_only()
def list_reminders(scope: str = "active") -> list[dict]:
	"""Return the caller's reminders. ``scope`` is active, completed or all."""
	filters: list[list] = [["owner", "=", frappe.session.user]]
	order_by = "next_trigger_at asc"
	if scope == "active":
		filters.append(["status", "=", STATUS_SCHEDULED])
	elif scope == "completed":
		filters.append(["status", "in", [STATUS_COMPLETED, STATUS_CANCELLED]])
		order_by = "modified desc"
	return [
		_summarize(frappe.get_doc(REMINDER, row))
		for row in frappe.get_all(REMINDER, filters=filters, order_by=order_by, pluck="name")
	]


@frappe.whitelist()
@frappe.read_only()
def get_reminder(name: str) -> dict:
	return _serialize(_owned(name))


@frappe.whitelist(methods=["POST"])
def delete_reminder(name: str) -> None:
	_owned(name)
	# Deliveries link to the reminder; remove them first to avoid a dangling link and to clear
	# any of this reminder's notifications from the inbox.
	for delivery in frappe.get_all(DELIVERY, filters={"reminder": name}, pluck="name"):
		frappe.delete_doc(DELIVERY, delivery, ignore_permissions=True)
	frappe.delete_doc(REMINDER, name)


@frappe.whitelist(methods=["POST"])
def complete_reminder(name: str) -> dict:
	"""Mark a reminder done for good and clear its notifications."""
	doc = _owned(name)
	doc.status = STATUS_COMPLETED
	doc.last_completed_at = _to_storage(_now_utc())
	doc.next_trigger_at = None
	doc.snoozed_until = None
	doc.save(ignore_permissions=True)
	_acknowledge_reminder(name)
	return _serialize(doc)


@frappe.whitelist(methods=["POST"])
def snooze_reminder(name: str, preset: str | None = None, until: str | None = None) -> dict:
	"""Re-point a reminder's next fire without changing its recurrence definition."""
	doc = _owned(name)
	target = _snooze_target(doc, preset, until)
	if target <= _now_utc():
		frappe.throw(_("Choose a snooze time in the future."))
	doc.snoozed_until = _to_storage(target)
	doc.next_trigger_at = _to_storage(target)
	doc.status = STATUS_SCHEDULED
	doc.save(ignore_permissions=True)
	_acknowledge_reminder(name)
	return _serialize(doc)


@frappe.whitelist()
@frappe.read_only()
def list_due() -> list[dict]:
	"""The in-app inbox: delivered, not-yet-acknowledged in-app notifications, soonest first."""
	rows = frappe.get_all(
		DELIVERY,
		filters=[
			["owner", "=", frappe.session.user],
			["channel", "=", CHANNEL_IN_APP],
			["status", "=", "Delivered"],
			["acknowledged_at", "is", "not set"],
		],
		fields=["name", "reminder", "reminder_title", "scheduled_for"],
		order_by="scheduled_for asc",
	)
	for row in rows:
		row["scheduled_for"] = _iso(_from_storage(row.get("scheduled_for")))
		row["note"] = frappe.db.get_value(REMINDER, row["reminder"], "note")
	return rows


@frappe.whitelist(methods=["POST"])
def acknowledge(delivery: str) -> None:
	"""Dismiss one in-app notification."""
	doc = frappe.get_doc(DELIVERY, delivery)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this notification."))
	doc.acknowledged_at = _to_storage(_now_utc())
	doc.save(ignore_permissions=True)


# --- Helpers --------------------------------------------------------------------------------


def _apply(doc, data: dict) -> None:
	doc.title = _truncate((data.get("title") or "").strip(), MAX_TITLE) or _("Untitled reminder")
	doc.note = _truncate((data.get("note") or "").strip(), MAX_NOTE) or None
	if not data.get("local_date") or not data.get("local_time") or not data.get("time_zone"):
		frappe.throw(_("A reminder needs a date, time and time zone."))
	doc.local_date = data["local_date"]
	doc.local_time = data["local_time"]
	doc.time_zone = data["time_zone"]
	doc.repeat_type = data.get("repeat_type") if data.get("repeat_type") in REPEAT_TYPES else "None"
	doc.repeat_interval = max(cint(data.get("repeat_interval")) or 1, 1)
	doc.repeat_end_date = data.get("repeat_end_date") or None
	doc.delivery_in_app = 0 if data.get("delivery_in_app") is False else 1
	doc.delivery_email = 1 if data.get("delivery_email") else 0
	doc.delivery_browser = 1 if data.get("delivery_browser") else 0
	doc.tags = _join_tags(data.get("tags"))


def _snooze_target(doc, preset: str | None, until: str | None) -> datetime:
	if preset in SNOOZE_MINUTES:
		return _now_utc() + timedelta(minutes=SNOOZE_MINUTES[preset])
	if preset == "tomorrow":
		# Tomorrow at the reminder's own local time, in its own zone (DST-safe).
		tz = schedule.resolve_timezone(doc.time_zone)
		tomorrow = _now_utc().astimezone(tz).date() + timedelta(days=1)
		return schedule.occurrence_instant(tomorrow, get_time(doc.local_time), doc.time_zone, "None", 1, 0)
	if until:
		return get_datetime(until).replace(tzinfo=timezone.utc)
	frappe.throw(_("Choose how long to snooze for."))


def _acknowledge_reminder(name: str) -> None:
	stamp = _to_storage(_now_utc())
	for delivery in frappe.get_all(
		DELIVERY,
		filters=[["reminder", "=", name], ["channel", "=", CHANNEL_IN_APP], ["acknowledged_at", "is", "not set"]],
		pluck="name",
	):
		frappe.db.set_value(DELIVERY, delivery, "acknowledged_at", stamp, update_modified=False)


def _summarize(doc) -> dict:
	return {
		"name": doc.name,
		"title": doc.title,
		"note": doc.note,
		"time_zone": doc.time_zone,
		"repeat_type": doc.repeat_type,
		"repeat_interval": doc.repeat_interval,
		"status": doc.status,
		"tags": _split_tags(doc.tags),
		"next_trigger": _iso(_from_storage(doc.next_trigger_at)),
		"snoozed_until": _iso(_from_storage(doc.snoozed_until)),
		"last_triggered": _iso(_from_storage(doc.last_triggered_at)),
	}


def _serialize(doc) -> dict:
	return {
		**_summarize(doc),
		"local_date": str(doc.local_date) if doc.local_date else None,
		"local_time": _time_str(doc.local_time),
		"repeat_end_date": str(doc.repeat_end_date) if doc.repeat_end_date else None,
		"delivery_in_app": bool(doc.delivery_in_app),
		"delivery_email": bool(doc.delivery_email),
		"delivery_browser": bool(doc.delivery_browser),
		"last_completed": _iso(_from_storage(doc.last_completed_at)),
		"creation": str(doc.creation),
		"modified": str(doc.modified),
	}


def _owned(name: str):
	if not name:
		raise frappe.DoesNotExistError(_("Reminder not found."))
	doc = frappe.get_doc(REMINDER, name)
	if doc.owner != frappe.session.user and frappe.session.user != "Administrator":
		raise frappe.PermissionError(_("You are not permitted to access this reminder."))
	return doc


def _iso(instant: datetime | None) -> str | None:
	return instant.isoformat() if instant else None


def _time_str(value: object) -> str | None:
	if not value:
		return None
	return get_time(value).strftime("%H:%M")


def _split_tags(value) -> list[str]:
	if not value:
		return []
	return [tag.strip() for tag in value.split(",") if tag.strip()]


def _join_tags(value) -> str | None:
	if not value:
		return None
	tags = _split_tags(value) if isinstance(value, str) else [str(tag).strip() for tag in value]
	seen: set[str] = set()
	unique: list[str] = []
	for tag in tags:
		if not tag:
			continue
		key = tag.lower()
		if key in seen or len(unique) >= MAX_TAGS:
			continue
		seen.add(key)
		unique.append(_truncate(tag, MAX_TAG_LENGTH))
	return ", ".join(unique) or None


def _truncate(text: str, limit: int) -> str:
	return text if len(text) <= limit else text[:limit]
