# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.permissions import (
	TOOLBOX_MANAGER_ROLE,
	TOOLBOX_USER_ROLE,
	backfill_toolbox_user_role,
	ensure_phase2_roles,
	has_owner_permission,
	owner_query_conditions,
)


class TestPhase2Permissions(IntegrationTestCase):
	def setUp(self):
		ensure_phase2_roles()

	def test_roles_are_created_idempotently(self):
		ensure_phase2_roles()
		self.assertTrue(frappe.db.exists("Role", TOOLBOX_USER_ROLE))
		self.assertTrue(frappe.db.exists("Role", TOOLBOX_MANAGER_ROLE))

	def test_owner_query_conditions_scopes_to_owner(self):
		condition = owner_query_conditions("Toolbox Note", "phase2-owner@example.com")
		self.assertIn("`tabToolbox Note`.`owner`", condition)
		self.assertIn("phase2-owner@example.com", condition)

	def test_owner_query_conditions_unfiltered_for_administrator(self):
		self.assertEqual(owner_query_conditions("Toolbox Note", "Administrator"), "")

	def test_has_owner_permission_is_owner_only(self):
		doc = frappe._dict(owner="alice@example.com")
		self.assertTrue(has_owner_permission(doc, "alice@example.com"))
		self.assertFalse(has_owner_permission(doc, "bob@example.com"))
		self.assertTrue(has_owner_permission(doc, "Administrator"))

	def test_new_user_is_enrolled_via_hook(self):
		user = _make_user("phase2-enrol@example.com")
		frappe.clear_cache(user=user)
		self.assertIn(TOOLBOX_USER_ROLE, frappe.get_roles(user))

	def test_guest_is_never_enrolled(self):
		self.assertNotIn(TOOLBOX_USER_ROLE, frappe.get_roles("Guest"))

	def test_backfill_enrols_a_user_missing_the_role(self):
		user = _make_user("phase2-backfill@example.com")
		frappe.get_doc("User", user).remove_roles(TOOLBOX_USER_ROLE)
		frappe.clear_cache(user=user)
		self.assertNotIn(TOOLBOX_USER_ROLE, frappe.get_roles(user))

		backfill_toolbox_user_role()
		frappe.clear_cache(user=user)
		self.assertIn(TOOLBOX_USER_ROLE, frappe.get_roles(user))


def _make_user(email: str) -> str:
	frappe.delete_doc_if_exists("User", email)
	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": "Phase2",
			"enabled": 1,
			"user_type": "System User",
			"send_welcome_email": 0,
		}
	).insert(ignore_permissions=True)
	return user.name
