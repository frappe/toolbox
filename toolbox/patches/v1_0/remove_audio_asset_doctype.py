import frappe

# Audio Recorder captures in the browser and saves to the visitor's own device, so Toolbox no
# longer stores recordings. Removing the DocType also removes the private File rows attached to
# each recording, which is the point: nothing of the visitor's audio stays on the server.
#
# `frappe.delete_doc` on a DocType keeps its table. See remove_account_tool_doctypes for why.
DOCTYPE = "Toolbox Audio Asset"


def execute() -> None:
	_delete_attached_files()
	frappe.delete_doc("DocType", DOCTYPE, force=True, ignore_missing=True)
	frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `tab{DOCTYPE}`")


def _delete_attached_files() -> None:
	"""Delete the private File rows and their contents before the owning rows disappear."""
	if not frappe.db.table_exists(DOCTYPE):
		return

	files = frappe.get_all(
		"File",
		filters={"attached_to_doctype": DOCTYPE},
		pluck="name",
	)
	for name in files:
		# delete_doc on File removes the row and unlinks the file from disk.
		frappe.delete_doc("File", name, force=True, ignore_missing=True, delete_permanently=True)
