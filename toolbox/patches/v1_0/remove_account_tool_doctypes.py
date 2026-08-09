import frappe

# Toolbox became a free public site with no accounts, so the tools that stored personal records
# for a signed-in owner left the product. `bench migrate` does not drop a DocType that leaves the
# codebase, so remove each definition and its table here. Tone Generator, Metronome and Audio
# Inspector went at the same time, but they held no data and owned no DocType.
#
# OTHER_IDEAS.md records the reason for every removal.
REMOVED_DOCTYPES = (
	# Child tables first, so no surviving parent still links to a live DocType.
	"Toolbox Checklist Item",
	"Toolbox Checklist Template Item",
	# Checklists
	"Toolbox Checklist",
	"Toolbox Checklist Template",
	# Notes
	"Toolbox Note",
	# Library
	"Toolbox Saved Link",
	"Toolbox Link Collection",
	# Reminders
	"Toolbox Reminder Delivery",
	"Toolbox Reminder",
	# Expenses
	"Toolbox Expense",
	"Toolbox Expense Budget",
	"Toolbox Expense Rule",
	"Toolbox Expense Project",
	"Toolbox Expense Category",
	"Toolbox Payment Method",
)


def execute() -> None:
	for doctype in REMOVED_DOCTYPES:
		# force=True skips the link check. The whole cluster goes together, so a link from one
		# removed DocType to another must not stop the deletion.
		frappe.delete_doc("DocType", doctype, force=True, ignore_missing=True)
		# delete_doc removes the definition but keeps the table. It only ever drops a table in
		# developer mode outside a migration (frappe/model/delete_doc.py), and a patch always
		# runs inside one. Without this the rows survive as an orphan table.
		frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `tab{doctype}`")
