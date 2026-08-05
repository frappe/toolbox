# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Preferences read-path recovery: drifted/corrupt stored data must never brick the app."""

import json
import unittest

import frappe

from toolbox.preferences import (
	DEFAULT_SETTINGS,
	SETTING_OPTIONS,
	default_preferences,
	deserialize_preferences,
	serialize_preferences,
)


class TestPreferenceRecovery(unittest.TestCase):
	def test_valid_payload_round_trips(self):
		valid = default_preferences()
		valid["favouriteToolIds"] = ["calculator"]
		result = deserialize_preferences(json.dumps(valid))
		self.assertEqual(result["favouriteToolIds"], ["calculator"])
		self.assertEqual(set(result["settings"]), set(SETTING_OPTIONS))

	def test_drifted_settings_are_filled_from_defaults(self):
		# A stored record from before a settings field existed: missing "theme".
		drifted = default_preferences()
		drifted["settings"].pop("theme")
		drifted["settings"]["numberFormat"] = "international"
		result = deserialize_preferences(json.dumps(drifted))
		self.assertEqual(set(result["settings"]), set(SETTING_OPTIONS))
		self.assertEqual(result["settings"]["numberFormat"], "international")  # kept
		self.assertEqual(result["settings"]["theme"], DEFAULT_SETTINGS["theme"])  # restored

	def test_unknown_tool_ids_are_dropped_but_valid_ones_kept(self):
		drifted = default_preferences()
		drifted["favouriteToolIds"] = ["calculator", "a-removed-tool"]
		result = deserialize_preferences(json.dumps(drifted))
		self.assertEqual(result["favouriteToolIds"], ["calculator"])

	def test_valid_saved_items_survive_recovery(self):
		drifted = default_preferences()
		drifted["settings"].pop("theme")  # force recovery
		drifted["savedCurrencyPairs"] = [{"from": "USD", "to": "INR"}]
		result = deserialize_preferences(json.dumps(drifted))
		self.assertEqual(result["savedCurrencyPairs"], [{"from": "USD", "to": "INR"}])

	def test_corrupt_or_empty_data_falls_back_to_defaults(self):
		self.assertEqual(deserialize_preferences("{not valid json"), default_preferences())
		self.assertEqual(deserialize_preferences("[]"), default_preferences())
		self.assertEqual(deserialize_preferences(""), default_preferences())

	def test_write_path_stays_strict(self):
		with self.assertRaises(frappe.ValidationError):
			serialize_preferences({"unknown": "field"})
