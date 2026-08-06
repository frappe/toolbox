# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import json
import math
import re
from typing import Never

import frappe
from frappe import _

PREFERENCE_SCHEMA_VERSION = 1
PREFERENCE_OPERATION_VERSION = 1
MAX_PREFERENCE_BYTES = 64 * 1024
MAX_RECENT_TOOLS = 10
MAX_SAVED_ITEMS = 20
MAX_PREFERENCE_OPERATIONS = 64

TOOL_IDS = frozenset(
	{
		"audio-editor",
		"audio-recorder",
		"calculator",
		"checklists",
		"currency-converter",
		"dictionary",
		"expenses",
		"financial-calculators",
		"gst-calculator",
		"health-calculators",
		"hsn-sac-lookup",
		"india-business-lookup",
		"library",
		"metronome",
		"notes",
		"reminders",
		"script-conversion",
		"timer",
		"tone-generator",
		"unit-converter",
		"weather",
		"world-clock",
	}
)

SETTING_OPTIONS: dict[str, tuple[object, ...]] = {
	"numberFormat": ("indian", "international"),
	"decimalPrecision": (0, 2, 4, 6),
	"dateFormat": ("DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"),
	"timeFormat": ("12-hour", "24-hour"),
	"defaultCurrency": ("INR", "USD", "EUR", "GBP", "AED", "SGD"),
	"measurementSystem": ("metric", "imperial"),
	"temperatureUnit": ("celsius", "fahrenheit"),
	"theme": ("system", "light", "dark"),
}

DEFAULT_SETTINGS: dict[str, object] = {
	"numberFormat": "indian",
	"decimalPrecision": 2,
	"dateFormat": "DD/MM/YYYY",
	"timeFormat": "12-hour",
	"defaultCurrency": "INR",
	"measurementSystem": "metric",
	"temperatureUnit": "celsius",
	"theme": "system",
}

_PREFERENCE_FIELDS = frozenset(
	{
		"version",
		"favouriteToolIds",
		"recentToolIds",
		"savedCurrencyPairs",
		"savedWeatherLocations",
		"savedWorldClockLocations",
		"settings",
	}
)
# Optional so preferences stored before this field existed still validate (default []).
_OPTIONAL_PREFERENCE_FIELDS = frozenset({"hiddenToolIds"})
_KNOWN_PREFERENCE_FIELDS = _PREFERENCE_FIELDS | _OPTIONAL_PREFERENCE_FIELDS
_SAVED_ITEM_FIELDS = (
	"savedCurrencyPairs",
	"savedWeatherLocations",
	"savedWorldClockLocations",
)
_OPERATION_FIELDS = frozenset({"version", "operations"})
_SAFE_KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
_UNSAFE_KEYS = frozenset({"__proto__", "constructor", "prototype"})
_MAX_OBJECT_FIELDS = 24
_MAX_NESTED_ITEMS = 20
_MAX_NESTING_DEPTH = 3
_MAX_STRING_LENGTH = 512
_MAX_NUMBER_MAGNITUDE = 1e15


def default_preferences() -> dict[str, object]:
	return {
		"version": PREFERENCE_SCHEMA_VERSION,
		"favouriteToolIds": [],
		"hiddenToolIds": [],
		"recentToolIds": [],
		"savedCurrencyPairs": [],
		"savedWeatherLocations": [],
		"savedWorldClockLocations": [],
		"settings": dict(DEFAULT_SETTINGS),
	}


def validate_preferences(payload: dict[str, object]) -> dict[str, object]:
	if not isinstance(payload, dict):
		_invalid("Preference data must be an object.")
	return PreferenceValidator().validate(payload)


def apply_preference_operations(
	preferences: dict[str, object], payload: dict[str, object]
) -> dict[str, object]:
	"""Apply an ordered, validated operation batch to the latest stored preferences."""
	updated = validate_preferences(preferences)
	operations = _validate_preference_operations(payload)

	for operation in operations:
		operation_type = operation["type"]
		if operation_type == "setFavourite":
			_apply_favourite_operation(updated, operation)
		elif operation_type == "setHidden":
			_apply_hidden_operation(updated, operation)
		elif operation_type == "prependRecent":
			_apply_recent_operation(updated, operation)
		elif operation_type == "clearRecent":
			updated["recentToolIds"] = []
		elif operation_type == "setSetting":
			updated["settings"][operation["key"]] = operation["value"]
		elif operation_type == "resetSettings":
			updated["settings"] = dict(DEFAULT_SETTINGS)
		elif operation_type == "replaceSavedItems":
			updated[operation["field"]] = operation["value"]

	return validate_preferences(updated)


def serialize_preferences(payload: dict[str, object]) -> str:
	normalized = validate_preferences(payload)
	serialized = _serialize(normalized)
	if len(serialized.encode("utf-8")) > MAX_PREFERENCE_BYTES:
		_invalid("The preference data is too large.")
	return serialized


def deserialize_preferences(value: str | None) -> dict[str, object]:
	"""Read stored preferences, recovering rather than throwing on drifted or corrupt data.

	Stored preferences can fall behind the current schema (e.g. after an app upgrade adds a
	settings field) or a removed tool can linger in a saved list. Reads must never brick the app,
	so a payload that fails validation is repaired best-effort onto defaults. The write path
	(``serialize_preferences``) stays strict.
	"""
	if not value:
		return default_preferences()

	try:
		payload = json.loads(value)
	except (TypeError, ValueError):
		return default_preferences()

	if not isinstance(payload, dict):
		return default_preferences()

	try:
		return validate_preferences(payload)
	except frappe.ValidationError:
		return _recover_preferences(payload)


def _recover_preferences(payload: dict[str, object]) -> dict[str, object]:
	"""Rebuild a valid payload from ``payload``, keeping every part that still validates."""
	recovered = default_preferences()

	settings = payload.get("settings")
	if isinstance(settings, dict):
		for key, options in SETTING_OPTIONS.items():
			if settings.get(key) in options:
				recovered["settings"][key] = settings[key]

	for field, limit in (
		("favouriteToolIds", len(TOOL_IDS)),
		("hiddenToolIds", len(TOOL_IDS)),
		("recentToolIds", MAX_RECENT_TOOLS),
	):
		ids = payload.get(field)
		if isinstance(ids, list):
			kept: list[str] = []
			for tool_id in ids:
				if isinstance(tool_id, str) and tool_id in TOOL_IDS and tool_id not in kept:
					kept.append(tool_id)
			recovered[field] = kept[:limit]

	validator = PreferenceValidator()
	for field in _SAVED_ITEM_FIELDS:
		items = payload.get(field)
		if isinstance(items, list):
			kept_items: list[dict[str, object]] = []
			for item in items:
				if not isinstance(item, dict):
					continue
				try:
					kept_items.append(validator._normalize_object(item, depth=0))
				except frappe.ValidationError:
					continue
			recovered[field] = kept_items[:MAX_SAVED_ITEMS]

	# Guaranteed valid now: every field was rebuilt from validated pieces.
	return validate_preferences(recovered)


class PreferenceValidator:
	def validate(self, payload: dict[str, object]) -> dict[str, object]:
		self._validate_fields(payload)
		self._validate_version(payload["version"])

		normalized = {
			"version": PREFERENCE_SCHEMA_VERSION,
			"favouriteToolIds": self._normalize_tool_ids(
				payload["favouriteToolIds"], "favouriteToolIds", len(TOOL_IDS)
			),
			"hiddenToolIds": self._normalize_tool_ids(
				payload.get("hiddenToolIds", []), "hiddenToolIds", len(TOOL_IDS)
			),
			"recentToolIds": self._normalize_tool_ids(
				payload["recentToolIds"], "recentToolIds", MAX_RECENT_TOOLS
			),
			"settings": self._normalize_settings(payload["settings"]),
		}

		for fieldname in _SAVED_ITEM_FIELDS:
			normalized[fieldname] = self._normalize_saved_items(payload[fieldname], fieldname)

		return normalized

	@staticmethod
	def _validate_fields(payload: dict[str, object]) -> None:
		fields = set(payload)
		missing = _PREFERENCE_FIELDS - fields
		unknown = fields - _KNOWN_PREFERENCE_FIELDS
		if missing:
			_invalid("Required preference fields are missing.")
		if unknown:
			_invalid("Unknown preference fields were provided.")

	@staticmethod
	def _validate_version(value: object) -> None:
		if type(value) is not int or value != PREFERENCE_SCHEMA_VERSION:
			_invalid("This preference version is not supported.")

	@staticmethod
	def _normalize_tool_ids(value: object, fieldname: str, limit: int) -> list[str]:
		if not isinstance(value, list):
			_invalid(f"{fieldname} must be a list.")
		if len(value) > limit:
			_invalid(f"{fieldname} contains too many entries.")

		result: list[str] = []
		for tool_id in value:
			if not isinstance(tool_id, str) or tool_id not in TOOL_IDS:
				_invalid(f"{fieldname} contains an unknown tool.")
			if tool_id not in result:
				result.append(tool_id)
		return result

	@staticmethod
	def _normalize_settings(value: object) -> dict[str, object]:
		if not isinstance(value, dict) or set(value) != set(SETTING_OPTIONS):
			_invalid("settings must contain exactly the supported setting fields.")

		settings: dict[str, object] = {}
		for fieldname, options in SETTING_OPTIONS.items():
			setting = value[fieldname]
			if type(setting) not in {str, int} or setting not in options:
				_invalid(f"settings.{fieldname} has an unsupported value.")
			settings[fieldname] = setting
		return settings

	def _normalize_saved_items(self, value: object, fieldname: str) -> list[dict[str, object]]:
		if not isinstance(value, list):
			_invalid(f"{fieldname} must be a list.")
		if len(value) > MAX_SAVED_ITEMS:
			_invalid(f"{fieldname} contains too many entries.")

		result: list[dict[str, object]] = []
		seen: set[str] = set()
		for item in value:
			if not isinstance(item, dict):
				_invalid(f"{fieldname} entries must be objects.")
			normalized = self._normalize_object(item, depth=0)
			serialized = _serialize(normalized)
			if serialized not in seen:
				seen.add(serialized)
				result.append(normalized)
		return result

	def _normalize_object(self, value: dict[object, object], depth: int) -> dict[str, object]:
		self._validate_depth(depth)
		if not value:
			_invalid("A saved item must contain at least one field.")
		if len(value) > _MAX_OBJECT_FIELDS:
			_invalid("A saved item contains too many fields.")

		result: dict[str, object] = {}
		for key, item in value.items():
			if not isinstance(key, str) or not _SAFE_KEY.fullmatch(key) or key in _UNSAFE_KEYS:
				_invalid("A saved item contains an unsafe field name.")
			result[key] = self._normalize_json_value(item, depth + 1)
		return result

	def _normalize_json_value(self, value: object, depth: int) -> object:
		self._validate_depth(depth)
		if value is None or isinstance(value, bool):
			return value
		if isinstance(value, str):
			if len(value) > _MAX_STRING_LENGTH:
				_invalid("A saved item contains text that is too long.")
			return value
		if type(value) in {int, float}:
			if not math.isfinite(value) or abs(value) > _MAX_NUMBER_MAGNITUDE:
				_invalid("A saved item contains an invalid number.")
			return value
		if isinstance(value, dict):
			return self._normalize_object(value, depth)
		if isinstance(value, list):
			if len(value) > _MAX_NESTED_ITEMS:
				_invalid("A saved item contains too many nested entries.")
			return [self._normalize_json_value(item, depth + 1) for item in value]
		_invalid("A saved item contains an unsupported value.")

	@staticmethod
	def _validate_depth(depth: int) -> None:
		if depth > _MAX_NESTING_DEPTH:
			_invalid("A saved item is nested too deeply.")


def _validate_preference_operations(payload: dict[str, object]) -> list[dict[str, object]]:
	if set(payload) != _OPERATION_FIELDS:
		_invalid("An operation batch must contain exactly version and operations.")
	if type(payload["version"]) is not int or payload["version"] != PREFERENCE_OPERATION_VERSION:
		_invalid("This preference operation version is not supported.")

	operations = payload["operations"]
	if not isinstance(operations, list):
		_invalid("operations must be a list.")
	if len(operations) > MAX_PREFERENCE_OPERATIONS:
		_invalid("Too many preference operations were provided.")

	return [_validate_preference_operation(operation) for operation in operations]


def _validate_preference_operation(operation: object) -> dict[str, object]:
	if not isinstance(operation, dict) or not isinstance(operation.get("type"), str):
		_invalid("Each preference operation must be an object with a type.")

	operation_type = operation["type"]
	if operation_type == "setFavourite":
		_validate_operation_fields(operation, {"type", "toolId", "isFavourite"})
		_validate_tool_id(operation["toolId"])
		if type(operation["isFavourite"]) is not bool:
			_invalid("setFavourite.isFavourite must be a boolean.")
	elif operation_type == "setHidden":
		_validate_operation_fields(operation, {"type", "toolId", "isHidden"})
		_validate_tool_id(operation["toolId"])
		if type(operation["isHidden"]) is not bool:
			_invalid("setHidden.isHidden must be a boolean.")
	elif operation_type == "prependRecent":
		_validate_operation_fields(operation, {"type", "toolId"})
		_validate_tool_id(operation["toolId"])
	elif operation_type in {"clearRecent", "resetSettings"}:
		_validate_operation_fields(operation, {"type"})
	elif operation_type == "setSetting":
		_validate_operation_fields(operation, {"type", "key", "value"})
		key = operation["key"]
		if not isinstance(key, str) or key not in SETTING_OPTIONS:
			_invalid("setSetting contains an unknown setting.")
		value = operation["value"]
		if type(value) not in {str, int} or value not in SETTING_OPTIONS[key]:
			_invalid("setSetting contains an unsupported value.")
	elif operation_type == "replaceSavedItems":
		_validate_operation_fields(operation, {"type", "field", "value"})
		if operation["field"] not in _SAVED_ITEM_FIELDS:
			_invalid("replaceSavedItems contains an unknown field.")
	else:
		_invalid("An unknown preference operation was provided.")

	return dict(operation)


def _validate_operation_fields(operation: dict[str, object], fields: set[str]) -> None:
	if set(operation) != fields:
		_invalid("A preference operation contains missing or unknown fields.")


def _validate_tool_id(tool_id: object) -> None:
	if not isinstance(tool_id, str) or tool_id not in TOOL_IDS:
		_invalid("A preference operation contains an unknown tool.")


def _apply_favourite_operation(
	preferences: dict[str, object], operation: dict[str, object]
) -> None:
	tool_id = operation["toolId"]
	favourites = preferences["favouriteToolIds"]
	if operation["isFavourite"] and tool_id not in favourites:
		favourites.append(tool_id)
	elif not operation["isFavourite"]:
		preferences["favouriteToolIds"] = [item for item in favourites if item != tool_id]


def _apply_hidden_operation(preferences: dict[str, object], operation: dict[str, object]) -> None:
	tool_id = operation["toolId"]
	hidden = preferences["hiddenToolIds"]
	if operation["isHidden"] and tool_id not in hidden:
		hidden.append(tool_id)
	elif not operation["isHidden"]:
		preferences["hiddenToolIds"] = [item for item in hidden if item != tool_id]


def _apply_recent_operation(preferences: dict[str, object], operation: dict[str, object]) -> None:
	tool_id = operation["toolId"]
	preferences["recentToolIds"] = [
		tool_id,
		*(item for item in preferences["recentToolIds"] if item != tool_id),
	][:MAX_RECENT_TOOLS]


def _serialize(payload: object) -> str:
	return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _invalid(message: str) -> Never:
	frappe.throw(_("Invalid Toolbox preferences: {0}").format(message), frappe.ValidationError)
