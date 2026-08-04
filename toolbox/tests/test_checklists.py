# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.checklists import (
	delete_checklist,
	duplicate_checklist,
	get_checklist,
	list_checklists,
	save_checklist,
)

USER_A = "checklist-a@example.com"
USER_B = "checklist-b@example.com"


class TestChecklists(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def _save(self, **data):
		return save_checklist(frappe.as_json(data))

	def test_quick_create_and_fetch(self):
		saved = self._save(title="Groceries", items=[{"item_text": "Milk"}, {"item_text": "Eggs"}])
		self.assertTrue(saved["name"])
		self.assertEqual(saved["title"], "Groceries")
		self.assertEqual(len(saved["items"]), 2)
		self.assertEqual(get_checklist(saved["name"])["items"][0]["item_text"], "Milk")

	def test_completion_sets_timestamp_and_order(self):
		saved = self._save(
			title="Trip",
			items=[{"item_text": "Pack", "is_completed": True}, {"item_text": "Book"}],
		)
		self.assertIsNotNone(saved["items"][0]["completed_at"])
		self.assertIsNone(saved["items"][1]["completed_at"])
		self.assertEqual([i["sort_order"] for i in saved["items"]], [0, 1])

	def test_reset_clears_completion(self):
		saved = self._save(title="Reset", items=[{"item_text": "A", "is_completed": True}])
		reset = self._save(
			name=saved["name"], title="Reset", items=[{"item_text": "A", "is_completed": False}]
		)
		self.assertFalse(reset["items"][0]["is_completed"])
		self.assertIsNone(reset["items"][0]["completed_at"])

	def test_tags_are_deduped_case_insensitively(self):
		saved = self._save(title="Tagged", tags=["home", "Home", "urgent"])
		self.assertEqual(saved["tags"], ["home", "urgent"])

	def test_empty_items_are_dropped(self):
		saved = self._save(title="Sparse", items=[{"item_text": "Real"}, {"item_text": "  "}])
		self.assertEqual(len(saved["items"]), 1)

	def test_duplicate_resets_completion_and_pin(self):
		saved = self._save(
			title="Packing", is_pinned=True, items=[{"item_text": "Socks", "is_completed": True}]
		)
		copy = duplicate_checklist(saved["name"])
		self.assertIn("(copy)", copy["title"])
		self.assertFalse(copy["is_pinned"])
		self.assertFalse(copy["items"][0]["is_completed"])
		self.assertNotEqual(copy["name"], saved["name"])

	def test_list_excludes_archived_by_default(self):
		self._save(title="Active")
		self._save(title="Old", is_archived=True)
		titles = [row["title"] for row in list_checklists()]
		self.assertIn("Active", titles)
		self.assertNotIn("Old", titles)
		self.assertIn("Old", [row["title"] for row in list_checklists(include_archived=1)])

	def test_owner_cannot_read_or_delete_another_users_checklist(self):
		mine = self._save(title="Private", items=[{"item_text": "secret"}])
		frappe.set_user(USER_B)
		self.assertEqual(list_checklists(), [])
		with self.assertRaises(frappe.PermissionError):
			get_checklist(mine["name"])
		with self.assertRaises(frappe.PermissionError):
			delete_checklist(mine["name"])


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Checklist",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
