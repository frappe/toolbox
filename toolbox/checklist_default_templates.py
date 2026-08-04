# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Version-controlled default system checklist templates.

These are generic starting points, not authoritative or complete lists. They make no legal,
tax, or medical completeness claims. Installed idempotently on migrate as System templates
(owner Administrator, read-only for regular users).
"""

import frappe

TEMPLATE_DOCTYPE = "Toolbox Checklist Template"
DEFAULT_TEMPLATE_VERSION = 1

DEFAULT_TEMPLATES = [
	{
		"template_name": "Packing checklist",
		"category": "Travel",
		"items": [
			"Passport / ID",
			"Tickets and bookings",
			"Wallet and cards",
			"Phone and charger",
			"Toiletries",
			"Medications",
			"Clothes",
			"Adapters and cables",
			"Keys",
			"Snacks and water",
		],
	},
	{
		"template_name": "Daily checklist",
		"category": "Routine",
		"items": [
			"Make the bed",
			"Plan the top 3 tasks",
			"Move / exercise",
			"Meals",
			"Water",
			"Clear the inbox",
			"Tidy up",
			"Review tomorrow",
		],
	},
	{
		"template_name": "Weekly reset",
		"category": "Routine",
		"items": [
			"Laundry",
			"Groceries",
			"Clean the kitchen",
			"Clean the bathroom",
			"Change bedsheets",
			"Plan the week",
			"Review the budget",
			"Back up files",
		],
	},
	{
		"template_name": "Grocery checklist",
		"category": "Shopping",
		"items": [
			"Fruits",
			"Vegetables",
			"Dairy",
			"Bread",
			"Grains and pulses",
			"Snacks",
			"Beverages",
			"Cleaning supplies",
			"Toiletries",
		],
	},
	{
		"template_name": "Trip preparation",
		"category": "Travel",
		"items": [
			"Book travel",
			"Book stay",
			"Check documents",
			"Pack bags",
			"Arrange local transport",
			"Download maps offline",
			"Inform a contact of the plan",
			"Set an out-of-office reply",
			"Charge devices",
		],
	},
	{
		"template_name": "Event preparation",
		"category": "Events",
		"items": [
			"Guest list",
			"Venue",
			"Invitations",
			"Food and drinks",
			"Seating",
			"Decorations",
			"Music and AV",
			"Run-of-show schedule",
			"Cleanup plan",
		],
	},
	{
		"template_name": "Home maintenance",
		"category": "Home",
		"items": [
			"Test smoke alarms",
			"Replace filters",
			"Check for plumbing leaks",
			"Clean gutters and drains",
			"Service appliances",
			"Check locks and doors",
			"Inspect electrical fittings",
			"Pest check",
		],
	},
	{
		"template_name": "Month-end personal finance",
		"category": "Finance",
		"items": [
			"Review income and spending",
			"Pay bills",
			"Check subscriptions",
			"Move money to savings",
			"Review the budget",
			"Update the expense tracker",
			"Check account statements",
		],
	},
	{
		"template_name": "Annual India financial documents",
		"category": "Finance",
		"items": [
			"PAN",
			"Aadhaar",
			"Form 16",
			"Bank statements",
			"Investment proofs",
			"Rent receipts",
			"Home loan interest certificate",
			"Insurance premium receipts",
			"Capital gains statements",
			"Previous year's return",
		],
	},
	{
		"template_name": "New employee first-day personal checklist",
		"category": "Work",
		"items": [
			"ID proof",
			"Bank details for salary",
			"PAN",
			"Emergency contact",
			"Signed offer letter",
			"Passport-size photos",
			"Educational certificates",
			"Previous employment documents",
			"Laptop and account setup",
			"Meet the team",
		],
	},
]


def install_default_checklist_templates() -> None:
	"""Create or refresh the System default templates. Idempotent; runs on every migrate."""
	for spec in DEFAULT_TEMPLATES:
		existing = frappe.db.get_value(
			TEMPLATE_DOCTYPE,
			{"template_name": spec["template_name"], "scope": "System"},
			["name", "version"],
			as_dict=True,
		)
		if existing and existing.version == DEFAULT_TEMPLATE_VERSION:
			continue

		doc = (
			frappe.get_doc(TEMPLATE_DOCTYPE, existing.name)
			if existing
			else frappe.new_doc(TEMPLATE_DOCTYPE)
		)
		doc.template_name = spec["template_name"]
		doc.description = spec.get("description")
		doc.scope = "System"
		doc.category = spec.get("category")
		doc.is_active = 1
		doc.version = DEFAULT_TEMPLATE_VERSION
		doc.set("items", [])
		for text in spec["items"]:
			doc.append("items", {"item_text": text})
		doc.flags.ignore_permissions = True
		doc.save()
