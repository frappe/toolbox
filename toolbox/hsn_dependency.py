# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from __future__ import annotations

import re
from typing import Protocol

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit

from toolbox.hsn_contract import ERP_NEXT_APP, INDIA_COMPLIANCE_APP, inspect_hsn_contract

TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
SYSTEM_MANAGER = "System Manager"


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=20, seconds=60)
def get_dependency_status(task_id: str | None = None) -> dict[str, object]:
	"""Return the safe runtime state for the India Compliance dependency."""
	return HsnDependencyService(FrappeDependencyRuntime()).get(task_id)


@frappe.whitelist(methods=["POST"])
def install_india_compliance(confirmed: bool = False) -> dict[str, object]:
	"""Request the fixed India Compliance app through Frappe Cloud."""
	return HsnDependencyService(FrappeDependencyRuntime()).install(confirmed)


class DependencyRuntime(Protocol):
	def installed_apps(self) -> set[str]: ...

	def is_system_manager(self) -> bool: ...

	def cloud_enabled(self) -> bool: ...

	def marketplace_apps(self) -> list[dict[str, object]]: ...

	def task(self, task_id: str) -> dict[str, object]: ...

	def install(self) -> dict[str, object]: ...

	def contract(self) -> dict[str, object]: ...

	def audit(self, status: str, detail: str) -> None: ...


class HsnDependencyService:
	def __init__(self, runtime: DependencyRuntime) -> None:
		self.runtime = runtime

	def get(self, task_id: str | None = None) -> dict[str, object]:
		task_id = _validate_task_id(task_id)
		installed = self.runtime.installed_apps()

		if INDIA_COMPLIANCE_APP in installed:
			return self._installed_status(installed)
		if task_id and self.runtime.is_system_manager() and self.runtime.cloud_enabled():
			return self._task_status(task_id)
		if not self.runtime.is_system_manager():
			return _state(
				"blocked",
				"India Compliance is required",
				"Ask a System Manager to install ERPNext and India Compliance on this site.",
			)
		if ERP_NEXT_APP not in installed:
			return _unsupported(
				"ERPNext must be installed before India Compliance can be added."
			)
		if not self.runtime.cloud_enabled():
			return _unsupported(
				"This host cannot install apps from Toolbox. Ask the bench administrator to install India Compliance."
			)

		app = self._marketplace_app()
		if not app or not app.get("installable"):
			required = str(app.get("required_version") or "") if app else ""
			message = "India Compliance is not available for this site's Frappe version."
			if required:
				message = f"India Compliance requires Frappe {required}."
			return _unsupported(message)

		return {
			**_state(
				"installable",
				"India Compliance can be installed",
				"A System Manager can request the fixed Marketplace app after explicit confirmation.",
			),
			"app": _public_app(app),
			"canInstall": True,
		}

	def install(self, confirmed: bool) -> dict[str, object]:
		if not self.runtime.is_system_manager():
			frappe.throw(_("Only a System Manager can install India Compliance."), frappe.PermissionError)
		if confirmed is not True:
			frappe.throw(_("Confirm the India Compliance installation first."), frappe.ValidationError)

		status = self.get()
		if status["state"] == "ready":
			return status
		if status["state"] != "installable":
			frappe.throw(_("India Compliance cannot be installed from this site."), frappe.ValidationError)

		try:
			result = self.runtime.install()
			task_id = _task_id_from_result(result)
		except Exception:
			frappe.log_error(title="Toolbox India Compliance install request failed")
			self.runtime.audit("Failed", "The Frappe Cloud install request failed.")
			return _state(
				"failed",
				"Installation request failed",
				"No app change was confirmed. Review the server log, then retry.",
			)

		self.runtime.audit("Success", f"Requested {INDIA_COMPLIANCE_APP}; task {task_id}.")
		return {
			**_state(
				"installing",
				"Installing India Compliance",
				"Frappe Cloud accepted the request. Toolbox will check the task until it finishes.",
			),
			"taskId": task_id,
		}

	def _installed_status(self, installed: set[str]) -> dict[str, object]:
		if ERP_NEXT_APP not in installed:
			return _unsupported("India Compliance is installed without its required ERPNext app.")
		try:
			contract = self.runtime.contract()
		except Exception:
			return _unsupported("The India Compliance HSN DocType is unavailable after installation.")
		if not contract.get("compatible"):
			return {**_unsupported("The installed HSN schema is not compatible with Toolbox."), "contract": contract}
		return {
			**_state(
				"ready",
				"India Compliance is ready",
				"Search uses the site's India Compliance HSN master and stores a versioned browser snapshot.",
			),
			"contract": contract,
		}

	def _task_status(self, task_id: str) -> dict[str, object]:
		task = self.runtime.task(task_id)
		status = str(task.get("status") or "").lower()
		if status in {"failed", "failure", "error", "cancelled", "canceled"}:
			return {
				**_state("failed", "Installation failed", "Review the Frappe Cloud task, then retry."),
				"taskId": task_id,
			}
		return {
			**_state(
				"installing",
				"Installing India Compliance",
				"The Marketplace task is still running. This page checks it automatically.",
			),
			"taskId": task_id,
		}

	def _marketplace_app(self) -> dict[str, object] | None:
		try:
			return next(
				(app for app in self.runtime.marketplace_apps() if app.get("name") == INDIA_COMPLIANCE_APP),
				None,
			)
		except Exception:
			return None


class FrappeDependencyRuntime:
	def installed_apps(self) -> set[str]:
		return set(frappe.get_installed_apps())

	def is_system_manager(self) -> bool:
		return frappe.session.user != "Guest" and SYSTEM_MANAGER in frappe.get_roles()

	def cloud_enabled(self) -> bool:
		from frappe.integrations.frappe_providers.cloud_settings import is_cloud_settings_enabled

		return is_cloud_settings_enabled()

	def marketplace_apps(self) -> list[dict[str, object]]:
		from frappe.integrations.frappe_providers.cloud_settings import get_marketplace_apps

		return list(get_marketplace_apps().get("apps") or [])

	def task(self, task_id: str) -> dict[str, object]:
		from frappe.integrations.frappe_providers.cloud_settings import get_task

		return get_task(task_id)

	def install(self) -> dict[str, object]:
		from frappe.integrations.frappe_providers.cloud_settings import install_app

		return install_app(INDIA_COMPLIANCE_APP)

	def contract(self) -> dict[str, object]:
		return inspect_hsn_contract()

	def audit(self, status: str, detail: str) -> None:
		frappe.get_doc(
			{
				"doctype": "Activity Log",
				"subject": "Toolbox India Compliance installation",
				"content": detail,
				"status": status,
				"user": frappe.session.user,
			}
		).insert(ignore_permissions=True)


def _validate_task_id(task_id: str | None) -> str | None:
	if task_id is None or task_id == "":
		return None
	if not isinstance(task_id, str) or not TASK_ID_PATTERN.fullmatch(task_id):
		frappe.throw(_("The installation task id is invalid."), frappe.ValidationError)
	return task_id


def _task_id_from_result(result: object) -> str:
	if not isinstance(result, dict):
		frappe.throw(_("Frappe Cloud did not return an installation task."), frappe.ValidationError)
	task_id = result.get("task_id") or result.get("taskId")
	if not isinstance(task_id, str) or not TASK_ID_PATTERN.fullmatch(task_id):
		frappe.throw(_("Frappe Cloud returned an invalid installation task."), frappe.ValidationError)
	return task_id


def _state(state: str, title: str, message: str) -> dict[str, object]:
	return {"schemaVersion": 1, "state": state, "title": title, "message": message, "canInstall": False}


def _unsupported(message: str) -> dict[str, object]:
	return {
		**_state("unsupported", "Administrator action required", message),
		"adminHandoff": {
			"app": INDIA_COMPLIANCE_APP,
			"requiredApp": ERP_NEXT_APP,
			"docsUrl": "https://docs.indiacompliance.app/docs/getting-started/installation",
		},
	}


def _public_app(app: dict[str, object]) -> dict[str, object]:
	return {
		"name": INDIA_COMPLIANCE_APP,
		"title": str(app.get("title") or "India Compliance"),
		"latestVersion": str(app.get("latest_version") or ""),
	}
