import frappe


def execute() -> None:
	frappe.db.add_index(
		"Toolbox Dictionary Entry",
		["dataset_release", "normalized_word"],
		"toolbox_dictionary_word",
	)
