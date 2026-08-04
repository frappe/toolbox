# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Shared permission foundation for Phase 2 personal modules.

Phase 2 records (notes, checklists, saved links, reminders, expenses, audio) are private to
their owner. Toolbox is authenticated-only, so every real user is granted the ``Toolbox User``
role and each personal DocType restricts access to its owner. ``Toolbox Manager`` administers
shared configuration (system templates, feature flags) without routine access to personal
content. Site administrators keep the technical access inherent to running a Frappe site.
"""

import frappe

TOOLBOX_USER_ROLE = "Toolbox User"
TOOLBOX_MANAGER_ROLE = "Toolbox Manager"

# Never enrolled as Toolbox users: the anonymous account and the bootstrap administrator.
_NON_TOOLBOX_USERS = frozenset({"Guest", "Administrator"})


def owner_query_conditions(doctype: str, user: str | None = None) -> str:
	"""Return a list/report filter that shows only the current user's rows of ``doctype``.

	Administrators and System Managers are unfiltered, matching the technical access inherent
	to administering the site. Everyone else sees only records they own.
	"""
	user = user or frappe.session.user
	if _has_full_access(user):
		return ""
	return f"`tab{doctype}`.`owner` = {frappe.db.escape(user)}"


def has_owner_permission(doc, user: str | None = None) -> bool:
	"""Return whether ``user`` may access ``doc`` (owner-only, plus site administrators)."""
	user = user or frappe.session.user
	if _has_full_access(user):
		return True
	return getattr(doc, "owner", None) == user


def _has_full_access(user: str) -> bool:
	return user == "Administrator" or "System Manager" in frappe.get_roles(user)


def ensure_phase2_roles() -> None:
	"""Create the Toolbox roles when missing. Idempotent; safe on every migrate."""
	for role_name in (TOOLBOX_USER_ROLE, TOOLBOX_MANAGER_ROLE):
		if not frappe.db.exists("Role", role_name):
			frappe.get_doc(
				{
					"doctype": "Role",
					"role_name": role_name,
					# Toolbox is used through the /toolbox web app, not the desk.
					"desk_access": 0,
				}
			).insert(ignore_permissions=True)


def assign_toolbox_user_role(user_doc, method: str | None = None) -> None:
	"""Grant the Toolbox User role to a real, enabled user. Wired to User doc events."""
	if not _is_enrollable(user_doc):
		return
	if not frappe.db.exists("Role", TOOLBOX_USER_ROLE):
		# Fresh install before migrate created the role; backfill enrols this user later.
		return
	existing = {row.role for row in user_doc.get("roles", [])}
	if TOOLBOX_USER_ROLE not in existing:
		user_doc.add_roles(TOOLBOX_USER_ROLE)


def backfill_toolbox_user_role() -> None:
	"""Ensure roles exist and enrol every existing enabled user. Idempotent; runs on migrate."""
	ensure_phase2_roles()
	for name in frappe.get_all("User", filters={"enabled": 1}, pluck="name"):
		if name in _NON_TOOLBOX_USERS:
			continue
		if not frappe.db.exists("Has Role", {"parent": name, "role": TOOLBOX_USER_ROLE}):
			frappe.get_doc("User", name).add_roles(TOOLBOX_USER_ROLE)


def _is_enrollable(user_doc) -> bool:
	# Every real, enabled account is a Toolbox user regardless of user_type: Toolbox is used
	# through the /toolbox web app, so personal users are typically Website Users.
	return user_doc.name not in _NON_TOOLBOX_USERS and bool(user_doc.get("enabled"))
