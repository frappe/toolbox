# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate, nowdate

from toolbox.expense_budgets import budget_progress, delete_budget, list_budgets, set_budget
from toolbox.expense_projects import (
	delete_project,
	list_projects,
	project_summary,
	save_project,
)
from toolbox.expense_settings import BUDGET, CATEGORY, EXPENSE, PAYMENT_METHOD, PROJECT, RULE
from toolbox.expenses import bulk_delete, bulk_update, list_expenses, save_expense, setup

USER_A = "plan-a@example.com"
USER_B = "plan-b@example.com"


class TestExpensePlanning(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user("Administrator")
		for email in (USER_A, USER_B):
			for doctype in (BUDGET, EXPENSE, RULE, PROJECT, CATEGORY, PAYMENT_METHOD):
				frappe.db.delete(doctype, {"owner": email})
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))
		setup()
		self.food = self._category("Food and Dining")
		self.transport = self._category("Transport")

	def _category(self, name):
		return frappe.get_all(
			CATEGORY, filters={"owner": frappe.session.user, "category_name": name}, pluck="name"
		)[0]

	def _project(self, **data):
		data.setdefault("project_name", "Goa trip")
		return save_project(frappe.as_json(data))

	def _expense(self, **data):
		data.setdefault("currency", "INR")
		data.setdefault("expense_date", nowdate())
		data.setdefault("category", self.food)
		return save_expense(frappe.as_json(data))

	# --- projects ---

	def test_create_and_list_project(self):
		created = self._project(project_type="Trip", budget=20000, default_currency="INR")
		self.assertTrue(created["name"])
		self.assertEqual(created["budget"], 20000)
		self.assertIn(created["name"], [p["name"] for p in list_projects()])

	def test_project_owner_isolation(self):
		mine = self._project()
		frappe.set_user(USER_B)
		setup()
		self.assertEqual(list_projects(), [])
		with self.assertRaises(frappe.PermissionError):
			project_summary(mine["name"])

	def test_project_with_expenses_cannot_be_deleted(self):
		project = self._project()
		self._expense(amount=500, description="Dinner", project_or_trip=project["name"])
		with self.assertRaises(frappe.ValidationError):
			delete_project(project["name"])

	def test_project_summary_totals_and_budget(self):
		project = self._project(budget=1000, default_currency="INR")
		self._expense(amount=300, description="Lunch", category=self.food, project_or_trip=project["name"])
		self._expense(amount=200, description="Cab", category=self.transport, project_or_trip=project["name"])
		self._expense(amount=50, description="Tip", currency="USD", project_or_trip=project["name"])
		summary = project_summary(project["name"])

		self.assertEqual(summary["base_currency"], "INR")
		self.assertEqual(summary["total_spent"], 500)
		self.assertEqual(summary["budget_remaining"], 500)
		self.assertEqual(summary["expense_count"], 3)
		self.assertEqual(sum(c["amount"] for c in summary["category_breakdown"]), 500)
		self.assertEqual({c["currency"] for c in summary["currencies"]}, {"INR", "USD"})

	# --- budgets ---

	def test_set_budget_upserts(self):
		today = getdate(nowdate())
		first = set_budget(frappe.as_json({"month": today.month, "year": today.year, "budget_amount": 5000, "currency": "INR"}))
		second = set_budget(frappe.as_json({"month": today.month, "year": today.year, "budget_amount": 6000, "currency": "INR"}))
		self.assertEqual(first["name"], second["name"])
		budgets = list_budgets(today.month, today.year)
		self.assertEqual(len(budgets), 1)
		self.assertEqual(budgets[0]["budget_amount"], 6000)

	def test_budget_progress_overall_and_category(self):
		today = getdate(nowdate())
		set_budget(frappe.as_json({"month": today.month, "year": today.year, "budget_amount": 1000, "currency": "INR"}))
		set_budget(frappe.as_json({"month": today.month, "year": today.year, "category": self.food, "budget_amount": 400, "currency": "INR"}))
		self._expense(amount=250, description="a", category=self.food)
		self._expense(amount=100, description="b", category=self.transport)

		progress = budget_progress(today.month, today.year, "INR")
		self.assertEqual(progress["overall"]["budget"], 1000)
		self.assertEqual(progress["overall"]["spent"], 350)
		self.assertEqual(progress["overall"]["remaining"], 650)
		food_row = next(c for c in progress["categories"] if c["category"] == self.food)
		self.assertEqual(food_row["spent"], 250)
		self.assertEqual(food_row["budget"], 400)

	def test_delete_budget(self):
		today = getdate(nowdate())
		created = set_budget(frappe.as_json({"month": today.month, "year": today.year, "budget_amount": 5000}))
		delete_budget(created["name"])
		self.assertEqual(list_budgets(today.month, today.year), [])

	# --- bulk actions ---

	def test_bulk_update_category_tag_and_project(self):
		project = self._project()
		e1 = self._expense(amount=10, description="one", category=self.food)
		e2 = self._expense(amount=20, description="two", category=self.food)
		count = bulk_update(
			frappe.as_json([e1["name"], e2["name"]]),
			category=self.transport,
			add_tag="work",
			project_or_trip=project["name"],
		)
		self.assertEqual(count, 2)
		for name in (e1["name"], e2["name"]):
			doc = frappe.get_doc(EXPENSE, name)
			self.assertEqual(doc.category, self.transport)
			self.assertEqual(doc.project_or_trip, project["name"])
			self.assertIn("work", doc.tags)

	def test_bulk_delete(self):
		e1 = self._expense(amount=10, description="one")
		e2 = self._expense(amount=20, description="two")
		self.assertEqual(bulk_delete(frappe.as_json([e1["name"], e2["name"]])), 2)
		self.assertEqual(list_expenses()["total"], 0)

	def test_bulk_update_rejects_another_users_expense(self):
		mine = self._expense(amount=10, description="mine")
		frappe.set_user(USER_B)
		setup()
		with self.assertRaises(frappe.PermissionError):
			bulk_update(frappe.as_json([mine["name"]]), add_tag="x")


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Plan",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
