# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import UnitTestCase

from toolbox.www.toolbox import get_context


class TestToolboxWebGate(UnitTestCase):
	"""The Toolbox web entry is authenticated-only: guests are redirected to login."""

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.local.flags.redirect_location = None

	def test_guest_is_redirected_to_login(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.Redirect):
			get_context()
		self.assertTrue(frappe.local.flags.redirect_location.startswith("/login?redirect-to="))

	def test_authenticated_user_receives_boot(self):
		frappe.set_user("Administrator")
		context = get_context()
		self.assertTrue(context.boot["is_logged_in"])
		self.assertEqual(context.boot["user"], "Administrator")
		self.assertIn("csrf_token", context.boot)
