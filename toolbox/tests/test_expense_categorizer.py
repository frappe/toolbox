# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Unit tests for the deterministic expense categoriser (no database)."""

import unittest

from toolbox.expense_categorizer import (
	CONFIDENCE_HIGH,
	CONFIDENCE_LOW,
	CONFIDENCE_MEDIUM,
	categorize,
	validate_pattern,
)


def rule(**kw):
	kw.setdefault("rule_name", "Rule")
	kw.setdefault("name", kw["rule_name"])
	kw.setdefault("priority", 0)
	kw.setdefault("match_field", "merchant")
	return kw


class TestPrecedence(unittest.TestCase):
	def test_no_signal_returns_no_suggestion(self):
		result = categorize("", "", rules=[])
		self.assertIsNone(result["category"])
		self.assertIsNone(result["confidence"])

	def test_builtin_keyword_is_low_confidence(self):
		result = categorize("Uber", "ride home", rules=[])
		self.assertEqual(result["category"], "Transport")
		self.assertEqual(result["confidence"], CONFIDENCE_LOW)

	def test_prior_choice_beats_builtin(self):
		# "amazon" is a built-in Shopping keyword, but a prior confirmed choice wins.
		result = categorize("Amazon", "order", rules=[], prior_choices={"amazon": "Subscriptions"})
		self.assertEqual(result["category"], "Subscriptions")
		self.assertEqual(result["confidence"], CONFIDENCE_MEDIUM)

	def test_user_rule_beats_prior_and_builtin(self):
		rules = [rule(match_type="exact", pattern="Amazon", category="Work", rule_name="Amazon work")]
		result = categorize("Amazon", "order", rules=rules, prior_choices={"amazon": "Shopping"})
		self.assertEqual(result["category"], "Work")
		self.assertEqual(result["confidence"], CONFIDENCE_HIGH)
		self.assertEqual(result["rule_name"], "Amazon work")

	def test_exact_merchant_outranks_contains_at_equal_priority(self):
		rules = [
			rule(match_type="contains", pattern="coffee", category="Treats", rule_name="c"),
			rule(match_type="exact", pattern="Blue Bottle Coffee", category="Cafe", rule_name="e"),
		]
		result = categorize("Blue Bottle Coffee", "", rules=rules)
		self.assertEqual(result["category"], "Cafe")

	def test_explicit_priority_overrides_specificity(self):
		rules = [
			rule(match_type="exact", pattern="Blue Bottle Coffee", category="Cafe", priority=50, rule_name="e"),
			rule(match_type="contains", pattern="coffee", category="Treats", priority=1, rule_name="c"),
		]
		result = categorize("Blue Bottle Coffee", "", rules=rules)
		self.assertEqual(result["category"], "Treats")

	def test_contains_rule_is_medium_confidence(self):
		rules = [rule(match_type="contains", pattern="swiggy", category="Food", rule_name="s")]
		result = categorize("Swiggy Order 123", "", rules=rules)
		self.assertEqual(result["confidence"], CONFIDENCE_MEDIUM)

	def test_stop_processing_rule_carries_extras(self):
		rules = [rule(match_type="exact", pattern="Netflix", category="Subs", payment_method="PM1", tags="fun")]
		result = categorize("Netflix", "", rules=rules)
		self.assertEqual(result["payment_method"], "PM1")
		self.assertEqual(result["tags"], "fun")


class TestMatchFields(unittest.TestCase):
	def test_description_field_rule(self):
		rules = [rule(match_field="description", match_type="contains", pattern="lunch", category="Food", rule_name="l")]
		result = categorize("Some Shop", "team lunch", rules=rules)
		self.assertEqual(result["category"], "Food")

	def test_combined_field_matches_either(self):
		rules = [rule(match_field="combined", match_type="contains", pattern="taxi", category="Transport", rule_name="t")]
		self.assertEqual(categorize("City Taxi", "", rules=rules)["category"], "Transport")
		self.assertEqual(categorize("", "airport taxi", rules=rules)["category"], "Transport")

	def test_regex_rule_matches_and_is_high_confidence(self):
		rules = [rule(match_type="regex", pattern=r"^INV-\d+", category="Fees", rule_name="inv")]
		result = categorize("INV-2093 processing", "", rules=rules)
		self.assertEqual(result["category"], "Fees")
		self.assertEqual(result["confidence"], CONFIDENCE_HIGH)

	def test_invalid_regex_rule_never_matches(self):
		rules = [rule(match_type="regex", pattern="(unclosed", category="X", rule_name="bad")]
		# Falls through to the built-in keyword instead of raising.
		result = categorize("Uber", "", rules=rules)
		self.assertEqual(result["category"], "Transport")


class TestValidatePattern(unittest.TestCase):
	def test_rejects_empty_and_overlong(self):
		with self.assertRaises(ValueError):
			validate_pattern("contains", "   ")
		with self.assertRaises(ValueError):
			validate_pattern("contains", "x" * 500)

	def test_rejects_invalid_regex(self):
		with self.assertRaises(ValueError):
			validate_pattern("regex", "(unclosed")

	def test_accepts_valid_regex(self):
		validate_pattern("regex", r"^INV-\d+$")  # should not raise
