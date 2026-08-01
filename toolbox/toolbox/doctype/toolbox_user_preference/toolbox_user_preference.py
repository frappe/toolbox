# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime
from pypika.terms import Values

from toolbox.preferences import (
	PREFERENCE_SCHEMA_VERSION,
	apply_preference_operations,
	default_preferences,
	deserialize_preferences,
	serialize_preferences,
	validate_preferences,
)

DOCTYPE = "Toolbox User Preference"


class ToolboxUserPreference(Document):
	_DOCTYPE_NAME = DOCTYPE

	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		preferences_json: DF.Code
		schema_version: DF.Int
		user: DF.Link
	# end: auto-generated types

	def before_insert(self) -> None:
		self.user = _current_user()
		self.schema_version = PREFERENCE_SCHEMA_VERSION

	def validate(self) -> None:
		user = _current_user()
		if self.name and self.name != user:
			frappe.throw(_("You cannot change another user's Toolbox preferences."), frappe.PermissionError)

		self.user = user
		self.schema_version = PREFERENCE_SCHEMA_VERSION
		self.preferences_json = serialize_preferences(deserialize_preferences(self.preferences_json))

	def get_payload(self) -> dict[str, object]:
		return deserialize_preferences(self.preferences_json)


@frappe.whitelist(methods=["GET"])
@frappe.read_only()
def get_preferences() -> dict[str, object]:
	user = _current_user()
	if not frappe.db.exists(DOCTYPE, user):
		return default_preferences()

	doc = frappe.get_doc(DOCTYPE, user)
	doc.check_permission("read")
	return doc.get_payload()


def save_preferences(payload: dict[str, object]) -> dict[str, object]:
	"""Replace preferences for internal setup and migration code only."""
	user = _current_user()
	preferences = validate_preferences(payload)
	_lock_user_preferences(user)
	_upsert_preferences(user, preferences)
	return preferences


@frappe.whitelist(methods=["POST"])
def update_preferences(payload: dict[str, object]) -> dict[str, object]:
	"""Merge semantic preference operations into the latest row while holding its user lock."""
	user = _current_user()
	preferences = _lock_user_preferences(user)
	updated = apply_preference_operations(preferences, payload)
	_upsert_preferences(user, updated)
	return updated


def get_permission_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if not user or user == "Guest":
		return "1 = 0"
	return f"`tab{DOCTYPE}`.`name` = {frappe.db.escape(user)}"


def has_permission(doc: Document, ptype: str = "read", user: str | None = None) -> bool:
	user = user or frappe.session.user
	if not user or user == "Guest":
		return False
	if ptype == "create" and doc.is_new():
		return doc.user in {None, "", user}
	return doc.name == user and doc.user == user


def _current_user() -> str:
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Sign in to store Toolbox preferences."), frappe.PermissionError)
	return user


def _lock_user_preferences(user: str) -> dict[str, object]:
	# The stable User row serializes both first insert and later preference updates.
	frappe.db.get_value("User", user, "name", for_update=True)
	preferences_json = frappe.db.get_value(
		DOCTYPE, user, "preferences_json", for_update=True
	)
	return deserialize_preferences(preferences_json)


def _upsert_preferences(user: str, preferences: dict[str, object]) -> None:
	# One statement preserves the one-record-per-user invariant across simultaneous first saves.
	preference = frappe.qb.DocType(DOCTYPE)
	timestamp = now_datetime()
	query = (
		frappe.qb.into(preference)
		.columns(
			preference.name,
			preference.creation,
			preference.modified,
			preference.modified_by,
			preference.owner,
			preference.docstatus,
			preference.idx,
			preference.user,
			preference.schema_version,
			preference.preferences_json,
		)
		.insert(
			user,
			timestamp,
			timestamp,
			user,
			user,
			0,
			0,
			user,
			PREFERENCE_SCHEMA_VERSION,
			serialize_preferences(preferences),
		)
	)
	updated_fields = (
		preference.modified,
		preference.modified_by,
		preference.schema_version,
		preference.preferences_json,
	)

	if frappe.db.db_type == "mariadb":
		for field in updated_fields:
			query = query.on_duplicate_key_update(field, Values(field))
	elif frappe.db.db_type == "postgres":
		query = query.on_conflict(preference.name)
		for field in updated_fields:
			query = query.do_update(field)
	else:
		raise NotImplementedError(f"Unsupported database type: {frappe.db.db_type}")

	query.run()
