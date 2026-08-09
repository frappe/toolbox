# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import UnitTestCase

from toolbox.www.toolbox import get_context


class TestToolboxWebEntry(UnitTestCase):
	"""The Toolbox web entry is open to everyone and identifies nobody."""

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_guest_receives_the_app(self):
		frappe.set_user("Guest")
		context = get_context()
		self.assertIn("csrf_token", context.boot)
		self.assertEqual(context.no_cache, 1)

	def test_boot_carries_no_identity(self):
		"""A page that names its visitor invites code that branches on who they are."""
		frappe.set_user("Guest")
		guest_boot = get_context().boot

		frappe.set_user("Administrator")
		admin_boot = get_context().boot

		for key in ("user", "full_name", "is_logged_in"):
			self.assertNotIn(key, guest_boot)
			self.assertNotIn(key, admin_boot)

		self.assertEqual(set(guest_boot), set(admin_boot))
