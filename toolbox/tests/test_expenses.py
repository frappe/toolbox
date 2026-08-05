# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import nowdate

from toolbox.expense_settings import (
	CATEGORY,
	EXPENSE,
	PAYMENT_METHOD,
	RULE,
	delete_category,
	list_categories,
	list_payment_methods,
	save_category,
	save_rule,
)
from toolbox.expenses import (
	dashboard,
	delete_expense,
	learn_rule,
	list_expenses,
	save_expense,
	setup,
	suggest_category,
)

USER_A = "expense-a@example.com"
USER_B = "expense-b@example.com"


class TestExpenses(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user("Administrator")
		for email in (USER_A, USER_B):
			for doctype in (EXPENSE, RULE, CATEGORY, PAYMENT_METHOD):
				frappe.db.delete(doctype, {"owner": email})
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))
		setup()
		self.cat = self._category("Food and Dining")

	def _category(self, name):
		return frappe.get_all(
			CATEGORY, filters={"owner": frappe.session.user, "category_name": name}, pluck="name"
		)[0]

	def _save(self, **data):
		data.setdefault("currency", "INR")
		data.setdefault("expense_date", nowdate())
		data.setdefault("category", self.cat)
		return save_expense(frappe.as_json(data))

	# --- setup / quick add ---

	def test_setup_seeds_defaults_once(self):
		self.assertEqual(len(list_categories()), 16)
		self.assertEqual(len(list_payment_methods()), 7)
		setup()  # idempotent
		self.assertEqual(len(list_categories()), 16)

	def test_quick_add(self):
		saved = self._save(amount=250, description="Lunch")
		self.assertTrue(saved["name"])
		self.assertEqual(saved["amount"], 250)
		self.assertEqual(saved["category_name"], "Food and Dining")

	def test_amount_must_be_positive(self):
		with self.assertRaises(frappe.ValidationError):
			self._save(amount=0, description="Free")

	def test_invalid_currency_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._save(amount=10, description="X", currency="RUPEE")

	# --- ownership ---

	def test_owner_isolation(self):
		mine = self._save(amount=99, description="Private")
		frappe.set_user(USER_B)
		self.assertEqual(list_expenses()["expenses"], [])
		with self.assertRaises(frappe.PermissionError):
			delete_expense(mine["name"])

	def test_cannot_use_another_users_category(self):
		others = self.cat
		frappe.set_user(USER_B)
		setup()
		with self.assertRaises(frappe.PermissionError):
			save_expense(frappe.as_json({"amount": 5, "description": "x", "currency": "INR", "category": others}))

	# --- categories ---

	def test_category_is_archived_not_deleted_when_in_use(self):
		self._save(amount=10, description="Coffee")
		with self.assertRaises(frappe.ValidationError):
			delete_category(self.cat)
		archived = save_category(frappe.as_json({"name": self.cat, "category_name": "Food and Dining", "is_archived": True}))
		self.assertTrue(archived["is_archived"])
		self.assertNotIn(self.cat, [c["name"] for c in list_categories()])

	# --- multi-currency ---

	def test_multicurrency_preserves_original_and_computes_base(self):
		saved = self._save(
			amount=100, description="Hotel", currency="USD",
			base_currency="INR", conversion_rate=83, conversion_source="manual",
		)
		self.assertEqual(saved["currency"], "USD")
		self.assertEqual(saved["amount"], 100)
		self.assertEqual(saved["base_amount"], 8300)
		self.assertEqual(saved["conversion_source"], "manual")

	def test_base_amount_cleared_without_rate(self):
		saved = self._save(amount=100, description="Cash only", currency="USD", base_currency="INR")
		self.assertIsNone(saved["base_amount"])

	# --- categorisation ---

	def test_builtin_suggestion_is_low_confidence(self):
		suggestion = suggest_category("Uber", "ride")
		self.assertEqual(suggestion["category_name"], "Transport")
		self.assertEqual(suggestion["confidence"], "low")
		self.assertTrue(suggestion["explanation"])

	def test_prior_choice_suggestion(self):
		grocery = self._category("Groceries")
		self._save(amount=40, description="weekly shop", merchant="Corner Store", category=grocery)
		suggestion = suggest_category("Corner Store", "")
		self.assertEqual(suggestion["category"], grocery)
		self.assertEqual(suggestion["confidence"], "medium")

	def test_learn_rule_then_high_confidence_suggestion(self):
		learn_rule("Blue Tokai", self.cat)
		suggestion = suggest_category("Blue Tokai", "")
		self.assertEqual(suggestion["category"], self.cat)
		self.assertEqual(suggestion["confidence"], "high")

	def test_learn_rule_is_idempotent(self):
		learn_rule("Blue Tokai", self.cat)
		learn_rule("Blue Tokai", self._category("Groceries"))
		rules = frappe.get_all(RULE, filters={"owner": frappe.session.user, "pattern": "Blue Tokai"})
		self.assertEqual(len(rules), 1)

	def test_invalid_regex_rule_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			save_rule(frappe.as_json({
				"rule_name": "bad", "match_type": "regex", "pattern": "(unclosed", "category": self.cat,
			}))

	# --- dashboard / listing ---

	def test_dashboard_reconciles_with_filtered_records(self):
		self._save(amount=100, description="a")
		self._save(amount=200, description="b")
		self._save(amount=50, description="c")
		self._save(amount=30, description="foreign", currency="USD")
		data = dashboard(currency="INR")
		self.assertEqual(data["spend_this_month"], 350)
		self.assertEqual(data["expense_count"], 3)
		self.assertEqual(data["other_currency_count"], 1)
		self.assertEqual(sum(row["amount"] for row in data["category_breakdown"]), 350)

	def test_search_and_filter(self):
		self._save(amount=100, description="Train ticket", merchant="IRCTC")
		self._save(amount=20, description="Snack")
		found = list_expenses(frappe.as_json({"search": "IRCTC"}))
		self.assertEqual(found["total"], 1)
		self.assertEqual(found["expenses"][0]["merchant"], "IRCTC")


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Expense",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
