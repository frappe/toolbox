# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.model.document import Document

from toolbox.permissions import has_owner_permission, owner_query_conditions

DOCTYPE = "Toolbox Audio Asset"


class ToolboxAudioAsset(Document):
	def on_trash(self):
		# Remove the private file this asset owns so deleting a recording never orphans its audio.
		if self.file:
			for name in frappe.get_all("File", filters={"file_url": self.file}, pluck="name"):
				frappe.delete_doc("File", name, ignore_permissions=True, force=True)


def get_permission_query_conditions(user: str | None = None) -> str:
	return owner_query_conditions(DOCTYPE, user)


def has_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	return has_owner_permission(doc, user)
