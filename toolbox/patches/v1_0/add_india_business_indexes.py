import frappe


def execute() -> None:
	frappe.db.add_index(
		"Toolbox Dataset Release",
		["dataset_type", "status"],
		"toolbox_dataset_active",
	)
	for field in ("pin_code", "office_name", "district", "state"):
		frappe.db.add_index(
			"Toolbox PIN Record",
			["dataset_release", field],
			f"toolbox_pin_{field}",
		)
	for field in ("ifsc_code", "bank_name", "branch", "city", "state"):
		frappe.db.add_index(
			"Toolbox IFSC Record",
			["dataset_release", field],
			f"toolbox_ifsc_{field}",
		)
