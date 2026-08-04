# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.notes import (
	delete_note,
	duplicate_note,
	get_note,
	list_notes,
	save_note,
)

USER_A = "note-a@example.com"
USER_B = "note-b@example.com"


class TestNotes(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def _save(self, **data):
		return save_note(frappe.as_json(data))

	def test_quick_create_and_fetch(self):
		saved = self._save(title="Ideas", content_html="<p>First idea</p>")
		self.assertTrue(saved["name"])
		self.assertEqual(saved["title"], "Ideas")
		fetched = get_note(saved["name"])
		self.assertIn("First idea", fetched["content_html"])

	def test_content_html_strips_scripts_and_event_handlers(self):
		saved = self._save(
			title="Hostile",
			content_html=(
				'<p onclick="steal()">Hello</p>'
				"<script>alert(1)</script>"
				'<img src="x" onerror="pwn()">'
			),
		)
		html = saved["content_html"].lower()
		self.assertNotIn("<script", html)
		self.assertNotIn("onclick", html)
		self.assertNotIn("onerror", html)
		self.assertIn("Hello", saved["content_html"])
		# The stored index is clean too.
		self.assertNotIn("<script", saved["search_text"].lower())

	def test_search_text_is_plain_text(self):
		saved = self._save(title="Groceries", content_html="<p>Buy <b>milk</b> today</p>")
		self.assertNotIn("<", saved["search_text"])
		self.assertNotIn(">", saved["search_text"])
		self.assertIn("milk", saved["search_text"])

	def test_list_excludes_archived_by_default(self):
		self._save(title="Active")
		self._save(title="Old", is_archived=True)
		titles = [row["title"] for row in list_notes()]
		self.assertIn("Active", titles)
		self.assertNotIn("Old", titles)
		self.assertIn("Old", [row["title"] for row in list_notes(include_archived=1)])

	def test_list_returns_excerpt_and_pins_first(self):
		self._save(title="Plain note", content_html="<p>body text</p>")
		self._save(title="Pinned note", content_html="<p>body text</p>", is_pinned=True)
		rows = list_notes()
		self.assertEqual(rows[0]["title"], "Pinned note")
		self.assertIn("excerpt", rows[0])
		self.assertIn("body text", rows[0]["excerpt"])

	def test_tags_are_deduped_case_insensitively(self):
		saved = self._save(title="Tagged", tags=["home", "Home", "urgent"])
		self.assertEqual(saved["tags"], ["home", "urgent"])

	def test_duplicate_resets_pin(self):
		saved = self._save(title="Recipe", content_html="<p>steps</p>", is_pinned=True)
		copy = duplicate_note(saved["name"])
		self.assertIn("(copy)", copy["title"])
		self.assertFalse(copy["is_pinned"])
		self.assertFalse(copy["is_archived"])
		self.assertNotEqual(copy["name"], saved["name"])

	def test_owner_cannot_read_or_delete_another_users_note(self):
		mine = self._save(title="Private", content_html="<p>secret</p>")
		frappe.set_user(USER_B)
		self.assertEqual(list_notes(), [])
		with self.assertRaises(frappe.PermissionError):
			get_note(mine["name"])
		with self.assertRaises(frappe.PermissionError):
			delete_note(mine["name"])


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Note",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
