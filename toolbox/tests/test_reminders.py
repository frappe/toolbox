# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from datetime import datetime, timedelta
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from toolbox import reminders
from toolbox.reminders import (
	CHANNEL_EMAIL,
	CHANNEL_IN_APP,
	DELIVERY,
	REMINDER,
	STATUS_COMPLETED,
	STATUS_SCHEDULED,
	_fire,
	_now_utc,
	_record_delivery,
	acknowledge,
	complete_reminder,
	delete_reminder,
	get_reminder,
	list_due,
	list_reminders,
	run_due_reminders,
	save_reminder,
	snooze_reminder,
)

USER_A = "reminder-a@example.com"
USER_B = "reminder-b@example.com"


class TestReminders(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		# The whole test class shares one transaction, so clear both users' rows between methods.
		frappe.set_user("Administrator")
		for email in (USER_A, USER_B):
			frappe.db.delete(DELIVERY, {"owner": email})
			frappe.db.delete(REMINDER, {"owner": email})
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	# --- helpers ---

	def _save(self, when: datetime, **data):
		data.setdefault("title", "Test reminder")
		data.setdefault("time_zone", "UTC")
		data["local_date"] = when.strftime("%Y-%m-%d")
		data["local_time"] = when.strftime("%H:%M:%S")
		return save_reminder(frappe.as_json(data))

	def _deliveries(self, name, channel=None):
		filters = {"reminder": name}
		if channel:
			filters["channel"] = channel
		return frappe.get_all(DELIVERY, filters=filters, fields=["name", "channel", "status"])

	# --- ownership ---

	def test_owner_cannot_read_or_delete_another_users_reminder(self):
		mine = self._save(_now_utc() - timedelta(hours=1))
		frappe.set_user(USER_B)
		self.assertEqual(list_reminders(), [])
		with self.assertRaises(frappe.PermissionError):
			get_reminder(mine["name"])
		with self.assertRaises(frappe.PermissionError):
			delete_reminder(mine["name"])

	# --- saving and scheduling ---

	def test_save_computes_trigger(self):
		saved = self._save(_now_utc() + timedelta(hours=2), repeat_type="None")
		self.assertTrue(saved["name"])
		self.assertEqual(saved["status"], STATUS_SCHEDULED)
		self.assertIsNotNone(saved["next_trigger"])

	def test_recurring_past_end_date_is_completed_on_save(self):
		saved = self._save(
			_now_utc() - timedelta(days=30),
			repeat_type="Daily",
			repeat_interval=1,
			repeat_end_date=(_now_utc() - timedelta(days=10)).strftime("%Y-%m-%d"),
		)
		self.assertEqual(saved["status"], STATUS_COMPLETED)
		self.assertIsNone(saved["next_trigger"])

	# --- firing ---

	def test_one_time_fires_once_and_completes(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="None")
		_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())

		deliveries = self._deliveries(saved["name"])
		self.assertEqual(len(deliveries), 1)
		self.assertEqual(deliveries[0]["channel"], CHANNEL_IN_APP)
		self.assertEqual(deliveries[0]["status"], "Delivered")

		after = get_reminder(saved["name"])
		self.assertEqual(after["status"], STATUS_COMPLETED)
		self.assertIsNone(after["next_trigger"])

	def test_retry_does_not_duplicate_delivery(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="None")
		doc = frappe.get_doc(REMINDER, saved["name"])
		occurrence = reminders._from_storage(doc.next_trigger_at)
		# Two attempts at the same occurrence/channel must yield exactly one delivery row.
		_record_delivery(doc, occurrence, CHANNEL_IN_APP, _now_utc())
		_record_delivery(doc, occurrence, CHANNEL_IN_APP, _now_utc())
		self.assertEqual(len(self._deliveries(saved["name"], CHANNEL_IN_APP)), 1)

	def test_daily_advances_and_stays_scheduled(self):
		saved = self._save(_now_utc() - timedelta(days=3), repeat_type="Daily", repeat_interval=1)
		trigger = datetime.fromisoformat(saved["next_trigger"])
		self.assertGreaterEqual(trigger, _now_utc())

		fire_at = trigger + timedelta(minutes=1)
		_fire(frappe.get_doc(REMINDER, saved["name"]), fire_at)

		after = get_reminder(saved["name"])
		self.assertEqual(after["status"], STATUS_SCHEDULED)
		self.assertGreater(datetime.fromisoformat(after["next_trigger"]), fire_at)
		self.assertEqual(len(self._deliveries(saved["name"])), 1)

	def test_recurrence_keeps_local_time_across_advance(self):
		# A New York 09:00 daily reminder must still fire at 09:00 local after advancing.
		anchor = _now_utc() - timedelta(days=2)
		saved = self._save(
			anchor.replace(hour=9, minute=0),
			time_zone="America/New_York",
			repeat_type="Daily",
			repeat_interval=1,
		)
		from zoneinfo import ZoneInfo

		trigger = datetime.fromisoformat(saved["next_trigger"]).astimezone(ZoneInfo("America/New_York"))
		self.assertEqual((trigger.hour, trigger.minute), (9, 0))

	def test_due_scheduler_selects_and_fires(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="None")
		# The scheduler runs as the site, and commits per reminder; keep the test transaction intact.
		frappe.set_user("Administrator")
		with patch.object(frappe.db, "commit"):
			run_due_reminders(_now_utc())
		self.assertEqual(len(self._deliveries(saved["name"], CHANNEL_IN_APP)), 1)

	# --- email ---

	def test_email_failure_does_not_block_in_app(self):
		saved = self._save(
			_now_utc() - timedelta(hours=1),
			repeat_type="None",
			delivery_email=True,
		)
		with patch("frappe.sendmail", side_effect=Exception("smtp down")):
			_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())

		in_app = self._deliveries(saved["name"], CHANNEL_IN_APP)
		email = self._deliveries(saved["name"], CHANNEL_EMAIL)
		self.assertEqual(in_app[0]["status"], "Delivered")
		self.assertEqual(email[0]["status"], "Failed")

	def test_email_success_records_delivered(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="None", delivery_email=True)
		with patch("frappe.sendmail") as sent:
			_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())
		sent.assert_called_once()
		self.assertEqual(self._deliveries(saved["name"], CHANNEL_EMAIL)[0]["status"], "Delivered")

	# --- inbox, snooze, complete ---

	def test_inbox_lists_and_acknowledges(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="None")
		_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())

		due = list_due()
		self.assertEqual(len(due), 1)
		self.assertEqual(due[0]["reminder"], saved["name"])
		acknowledge(due[0]["name"])
		self.assertEqual(list_due(), [])

	def test_snooze_reschedules_and_clears_inbox(self):
		saved = self._save(_now_utc() - timedelta(days=1), repeat_type="Daily", repeat_interval=1)
		_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())
		self.assertEqual(len(list_due()), 1)

		snoozed = snooze_reminder(saved["name"], preset="1h")
		self.assertEqual(snoozed["status"], STATUS_SCHEDULED)
		self.assertEqual(snoozed["repeat_type"], "Daily")  # recurrence definition unchanged
		next_fire = datetime.fromisoformat(snoozed["next_trigger"])
		self.assertGreater(next_fire, _now_utc())
		self.assertLess(next_fire, _now_utc() + timedelta(hours=2))
		self.assertEqual(list_due(), [])  # the fired notification was acknowledged

	def test_complete_marks_done_and_clears_inbox(self):
		saved = self._save(_now_utc() - timedelta(hours=1), repeat_type="Daily", repeat_interval=1)
		_fire(frappe.get_doc(REMINDER, saved["name"]), _now_utc())

		completed = complete_reminder(saved["name"])
		self.assertEqual(completed["status"], STATUS_COMPLETED)
		self.assertIsNone(completed["next_trigger"])
		self.assertIsNotNone(completed["last_completed"])
		self.assertEqual(list_due(), [])

	def test_list_scopes(self):
		active = self._save(_now_utc() + timedelta(hours=1), repeat_type="None")
		done = self._save(_now_utc() + timedelta(hours=2), repeat_type="None")
		complete_reminder(done["name"])

		active_names = [row["name"] for row in list_reminders("active")]
		completed_names = [row["name"] for row in list_reminders("completed")]
		self.assertIn(active["name"], active_names)
		self.assertNotIn(done["name"], active_names)
		self.assertIn(done["name"], completed_names)


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Reminder",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
