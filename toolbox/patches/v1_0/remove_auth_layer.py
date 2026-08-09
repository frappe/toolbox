import frappe

# Toolbox became a free public website with no accounts, so nothing is stored for a visitor.
# Preferences live in the browser now, which retires the per-user record and the two roles that
# guarded it.
#
# `frappe.delete_doc` on a DocType keeps its table. See remove_account_tool_doctypes for why.
DOCTYPE = "Toolbox User Preference"
ROLES = ("Toolbox User", "Toolbox Manager")


def execute() -> None:
	frappe.delete_doc("DocType", DOCTYPE, force=True, ignore_missing=True)
	frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `tab{DOCTYPE}`")

	for role in ROLES:
		# Deleting a Role does not clear the rows that grant it, and a stale Has Role pointing at
		# a missing Role breaks the user form. Clear the grants first.
		frappe.db.delete("Has Role", {"role": role})
		frappe.delete_doc("Role", role, force=True, ignore_missing=True)
