import frappe

# Weather is removed, and it was the only reader of the bundled city dataset, so the two city
# DocTypes go with it. Nothing else geocodes: World Clock carries its own list of cities in the
# frontend and never asked the server.
#
# `frappe.delete_doc` on a DocType keeps its table. `frappe/model/delete_doc.py` drops one only in
# developer mode outside a migration, and a patch always runs inside one, so each table is dropped
# here by name. See remove_account_tool_doctypes, where the first run left 15 tables behind.
DOCTYPES = ("Toolbox City Alias", "Toolbox City Record")

# The release ledger rows that versioned the dataset. Deleting the DocTypes leaves these behind,
# and a stale Active release for a dataset nothing imports would report a dataset that is gone.
RELEASE_DOCTYPE = "Toolbox Dataset Release"
DATASET_TYPE = "City"


def execute() -> None:
	_delete_city_releases()
	for doctype in DOCTYPES:
		frappe.delete_doc("DocType", doctype, force=True, ignore_missing=True)
		frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `tab{doctype}`")


def _delete_city_releases() -> None:
	if not frappe.db.table_exists(RELEASE_DOCTYPE):
		return

	releases = frappe.get_all(RELEASE_DOCTYPE, filters={"dataset_type": DATASET_TYPE}, pluck="name")
	for name in releases:
		frappe.delete_doc(RELEASE_DOCTYPE, name, force=True, ignore_missing=True)
