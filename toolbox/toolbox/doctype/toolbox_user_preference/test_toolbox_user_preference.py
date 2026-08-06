# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from copy import deepcopy

import frappe
from frappe.exceptions import FrappeTypeError
from frappe.handler import execute_cmd
from frappe.tests import IntegrationTestCase

from toolbox.preferences import MAX_RECENT_TOOLS, default_preferences
from toolbox.toolbox.doctype.toolbox_user_preference.toolbox_user_preference import (
	DOCTYPE,
	get_preferences,
	save_preferences,
	update_preferences,
)

TEST_USER_A = "toolbox-preferences-a@example.com"
TEST_USER_B = "toolbox-preferences-b@example.com"
LEGACY_SAVE_COMMAND = (
	"toolbox.toolbox.doctype.toolbox_user_preference.toolbox_user_preference.save_preferences"
)


class TestToolboxUserPreference(IntegrationTestCase):
	def setUp(self) -> None:
		frappe.set_user("Administrator")
		self._create_user(TEST_USER_A)
		self._create_user(TEST_USER_B)
		frappe.db.delete(DOCTYPE, {"user": ("in", [TEST_USER_A, TEST_USER_B])})

	def tearDown(self) -> None:
		frappe.set_user("Administrator")

	def test_missing_record_returns_defaults_without_writing(self) -> None:
		frappe.set_user(TEST_USER_A)

		self.assertEqual(get_preferences(), default_preferences())
		self.assertFalse(frappe.db.exists(DOCTYPE, TEST_USER_A))

	def test_save_creates_and_updates_one_user_record(self) -> None:
		frappe.set_user(TEST_USER_A)
		first = self._sample_preferences()
		first["hiddenToolIds"] = ["calculator", "unit-converter"]

		self.assertEqual(save_preferences(first), first)
		doc = frappe.get_doc(DOCTYPE, TEST_USER_A)
		self.assertEqual(doc.user, TEST_USER_A)
		self.assertEqual(doc.owner, TEST_USER_A)
		creation = doc.creation

		second = self._sample_preferences()
		second["recentToolIds"] = ["timer", "calculator"]
		self.assertEqual(save_preferences(second), second)
		self.assertEqual(frappe.db.count(DOCTYPE, {"user": TEST_USER_A}), 1)
		self.assertEqual(get_preferences(), second)
		self.assertEqual(frappe.db.get_value(DOCTYPE, TEST_USER_A, "creation"), creation)

	def test_users_can_only_list_and_read_their_own_record(self) -> None:
		frappe.set_user(TEST_USER_A)
		save_preferences(self._sample_preferences())
		frappe.set_user(TEST_USER_B)
		save_preferences(self._sample_preferences())

		frappe.set_user(TEST_USER_A)
		self.assertEqual(frappe.get_list(DOCTYPE, pluck="name"), [TEST_USER_A])
		other_user_doc = frappe.get_doc(DOCTYPE, TEST_USER_B)
		self.assertRaises(frappe.PermissionError, other_user_doc.check_permission, "read")
		self.assertRaises(frappe.PermissionError, other_user_doc.save)

	def test_guest_cannot_read_or_write_preferences(self) -> None:
		frappe.set_user("Guest")

		self.assertRaises(frappe.PermissionError, get_preferences)
		self.assertRaises(frappe.PermissionError, save_preferences, self._sample_preferences())
		self.assertRaises(frappe.PermissionError, update_preferences, self._operations())

	def test_payload_argument_is_type_checked(self) -> None:
		frappe.set_user(TEST_USER_A)

		self.assertRaises(frappe.ValidationError, save_preferences, "not-an-object")
		self.assertRaises(FrappeTypeError, update_preferences, "not-an-object")

	def test_invalid_payloads_do_not_replace_valid_preferences(self) -> None:
		frappe.set_user(TEST_USER_A)
		valid = self._sample_preferences()
		valid["hiddenToolIds"] = ["calculator"]
		save_preferences(valid)

		invalid_payloads = [
			self._with_value(valid, "version", 2),
			self._with_value(valid, "hiddenToolIds", ["unknown-tool"]),
			self._with_value(valid, "recentToolIds", ["calculator"] * (MAX_RECENT_TOOLS + 1)),
			self._with_nested_value(valid, "settings", "decimalPrecision", 3),
			self._with_value(valid, "savedWeatherLocations", [{"__proto__": {"admin": True}}]),
			self._with_value(valid, "savedWorldClockLocations", [{"offset": float("inf")}]),
		]
		with_unknown_field = deepcopy(valid)
		with_unknown_field["unknown"] = True
		invalid_payloads.append(with_unknown_field)

		for payload in invalid_payloads:
			with self.subTest(payload=payload):
				self.assertRaises(frappe.ValidationError, save_preferences, payload)
				self.assertEqual(get_preferences(), valid)

	def test_duplicate_entries_are_stored_once(self) -> None:
		frappe.set_user(TEST_USER_A)
		preferences = self._sample_preferences()
		preferences["hiddenToolIds"] = ["calculator", "calculator"]
		preferences["savedCurrencyPairs"] = [
			{"baseCurrency": "INR", "quoteCurrency": "USD"},
			{"quoteCurrency": "USD", "baseCurrency": "INR"},
		]

		stored = save_preferences(preferences)

		self.assertEqual(stored["hiddenToolIds"], ["calculator"])
		self.assertEqual(
			stored["savedCurrencyPairs"], [{"baseCurrency": "INR", "quoteCurrency": "USD"}]
		)

	def test_operation_batch_merges_with_latest_preferences(self) -> None:
		frappe.set_user(TEST_USER_A)
		initial = self._sample_preferences()
		initial["hiddenToolIds"] = ["timer"]
		initial["recentToolIds"] = ["world-clock"]
		save_preferences(initial)

		updated = update_preferences(
			self._operations(
				{"type": "setHidden", "toolId": "calculator", "isHidden": True},
				{"type": "prependRecent", "toolId": "calculator"},
			)
		)

		self.assertEqual(updated["hiddenToolIds"], ["timer", "calculator"])
		self.assertEqual(updated["recentToolIds"], ["calculator", "world-clock"])

	def test_set_hidden_operation_toggles_sidebar_visibility(self) -> None:
		frappe.set_user(TEST_USER_A)
		save_preferences(self._sample_preferences())

		hidden = update_preferences(
			self._operations(
				{"type": "setHidden", "toolId": "weather", "isHidden": True},
				{"type": "setHidden", "toolId": "dictionary", "isHidden": True},
			)
		)
		self.assertEqual(hidden["hiddenToolIds"], ["weather", "dictionary"])

		shown = update_preferences(
			self._operations({"type": "setHidden", "toolId": "weather", "isHidden": False})
		)
		self.assertEqual(shown["hiddenToolIds"], ["dictionary"])

	def test_preferences_stored_without_hidden_field_load_as_empty(self) -> None:
		frappe.set_user(TEST_USER_A)
		legacy = self._sample_preferences()
		del legacy["hiddenToolIds"]
		save_preferences(legacy)

		self.assertEqual(get_preferences()["hiddenToolIds"], [])

	def test_two_stale_clients_do_not_overwrite_unrelated_changes(self) -> None:
		frappe.set_user(TEST_USER_A)
		save_preferences(self._sample_preferences())
		first_stale_snapshot = get_preferences()
		second_stale_snapshot = get_preferences()
		self.assertEqual(first_stale_snapshot, second_stale_snapshot)

		update_preferences(
			self._operations(
				{"type": "setHidden", "toolId": "calculator", "isHidden": True},
				{"type": "prependRecent", "toolId": "calculator"},
			)
		)
		updated = update_preferences(
			self._operations(
				{"type": "setHidden", "toolId": "timer", "isHidden": True},
				{"type": "prependRecent", "toolId": "timer"},
			)
		)

		self.assertEqual(updated["hiddenToolIds"], ["calculator", "timer"])
		self.assertEqual(updated["recentToolIds"], ["timer", "calculator"])

	def test_two_stale_full_snapshot_clients_cannot_call_legacy_save(self) -> None:
		frappe.set_user(TEST_USER_A)
		save_preferences(self._sample_preferences())
		first_stale_snapshot = get_preferences()
		second_stale_snapshot = get_preferences()
		update_preferences(
			self._operations(
				{"type": "setHidden", "toolId": "calculator", "isHidden": True}
			)
		)
		first_stale_snapshot["hiddenToolIds"] = ["timer"]
		second_stale_snapshot["hiddenToolIds"] = ["world-clock"]

		previous_form_dict = frappe.form_dict
		try:
			for snapshot in (first_stale_snapshot, second_stale_snapshot):
				frappe.form_dict = frappe._dict(payload=snapshot)
				self.assertRaises(frappe.PermissionError, execute_cmd, LEGACY_SAVE_COMMAND)
		finally:
			frappe.form_dict = previous_form_dict

		self.assertEqual(get_preferences()["hiddenToolIds"], ["calculator"])

	def test_clear_recent_is_explicit_and_ordered(self) -> None:
		frappe.set_user(TEST_USER_A)
		initial = self._sample_preferences()
		initial["recentToolIds"] = ["world-clock", "calculator"]
		save_preferences(initial)

		updated = update_preferences(
			self._operations(
				{"type": "clearRecent"},
				{"type": "prependRecent", "toolId": "timer"},
			)
		)

		self.assertEqual(updated["recentToolIds"], ["timer"])

	def test_invalid_operation_batch_does_not_replace_preferences(self) -> None:
		frappe.set_user(TEST_USER_A)
		valid = self._sample_preferences()
		valid["hiddenToolIds"] = ["calculator"]
		save_preferences(valid)

		invalid_batches = [
			{"version": 2, "operations": []},
			self._operations({"type": "setHidden", "toolId": "missing", "isHidden": True}),
			self._operations({"type": "setHidden", "toolId": "timer", "isHidden": "yes"}),
			self._operations({"type": "unknown"}),
		]
		for payload in invalid_batches:
			with self.subTest(payload=payload):
				self.assertRaises(frappe.ValidationError, update_preferences, payload)
				self.assertEqual(get_preferences(), valid)

	def test_endpoints_declare_http_methods(self) -> None:
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[get_preferences], ("GET", "QUERY")
		)
		self.assertNotIn(save_preferences, frappe.whitelisted)
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[update_preferences], ("POST",)
		)

	@staticmethod
	def _sample_preferences() -> dict[str, object]:
		return default_preferences()

	@staticmethod
	def _operations(*operations: dict[str, object]) -> dict[str, object]:
		return {"version": 1, "operations": list(operations)}

	@staticmethod
	def _with_value(payload: dict[str, object], key: str, value: object) -> dict[str, object]:
		updated = deepcopy(payload)
		updated[key] = value
		return updated

	@staticmethod
	def _with_nested_value(
		payload: dict[str, object], parent: str, key: str, value: object
	) -> dict[str, object]:
		updated = deepcopy(payload)
		updated[parent][key] = value
		return updated

	@staticmethod
	def _create_user(email: str) -> None:
		if frappe.db.exists("User", email):
			return
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Toolbox Preferences Test",
				"send_welcome_email": 0,
				"user_type": "Website User",
			}
		).insert(ignore_permissions=True)
