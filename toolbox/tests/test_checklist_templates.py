# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.checklist_default_templates import (
	DEFAULT_TEMPLATES,
	install_default_checklist_templates,
)
from toolbox.checklist_templates import (
	create_checklist_from_template,
	delete_template,
	list_templates,
	save_as_template,
)
from toolbox.checklists import save_checklist

USER_A = "tpl-a@example.com"
USER_B = "tpl-b@example.com"


class TestChecklistTemplates(IntegrationTestCase):
	def setUp(self):
		install_default_checklist_templates()
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def _checklist(self, title, items):
		return save_checklist(
			frappe.as_json({"title": title, "items": [{"item_text": t} for t in items]})
		)

	def test_default_system_templates_installed(self):
		count = frappe.db.count("Toolbox Checklist Template", {"scope": "System"})
		self.assertGreaterEqual(count, len(DEFAULT_TEMPLATES))

	def test_list_includes_system_templates(self):
		templates = list_templates()
		names = [t["template_name"] for t in templates]
		self.assertIn("Packing checklist", names)
		self.assertTrue(all(t["is_system"] for t in templates if t["template_name"] == "Packing checklist"))

	def test_create_checklist_from_system_template(self):
		created = create_checklist_from_template("Packing checklist")
		self.assertEqual(created["source_template"], "Packing checklist")
		self.assertGreater(len(created["items"]), 0)
		self.assertEqual(
			frappe.db.get_value("Toolbox Checklist", created["name"], "owner"), USER_A
		)

	def test_save_as_personal_template_and_reuse(self):
		checklist = self._checklist("My routine", ["Wake up", "Coffee"])
		tpl = save_as_template(checklist["name"], "My routine template")
		self.assertFalse(tpl["is_system"])
		reused = create_checklist_from_template(tpl["name"])
		self.assertEqual([i["item_text"] for i in reused["items"]], ["Wake up", "Coffee"])

	def test_personal_template_is_private_but_system_is_shared(self):
		checklist = self._checklist("A secret", ["hidden"])
		tpl = save_as_template(checklist["name"], "A private template")

		frappe.set_user(USER_B)
		names = [t["template_name"] for t in list_templates()]
		self.assertNotIn("A private template", names)
		self.assertIn("Packing checklist", names)
		with self.assertRaises(frappe.PermissionError):
			create_checklist_from_template(tpl["name"])

	def test_users_cannot_delete_system_templates(self):
		system_name = frappe.db.get_value(
			"Toolbox Checklist Template",
			{"template_name": "Packing checklist", "scope": "System"},
			"name",
		)
		with self.assertRaises(frappe.PermissionError):
			delete_template(system_name)

	def test_user_can_delete_own_personal_template(self):
		checklist = self._checklist("Temp", ["x"])
		tpl = save_as_template(checklist["name"], "Deletable")
		delete_template(tpl["name"])
		self.assertFalse(frappe.db.exists("Toolbox Checklist Template", tpl["name"]))


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Tpl",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
