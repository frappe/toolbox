# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from datetime import datetime, timezone
from unittest.mock import Mock, patch

import frappe
from frappe.tests import UnitTestCase

from toolbox.hsn_catalog import HsnCatalogService, get_hsn_catalog
from toolbox.hsn_contract import MISSING_STATUTORY_FIELDS, inspect_hsn_contract
from toolbox.hsn_dependency import (
	HsnDependencyService,
	get_dependency_status,
	install_india_compliance,
)

MODIFIED = datetime(2026, 7, 31, 12, 0, tzinfo=timezone.utc)


class FakeRuntime:
	def __init__(self) -> None:
		self.apps = {"erpnext"}
		self.manager = True
		self.cloud = True
		self.marketplace = [
			{
				"name": "india_compliance",
				"title": "India Compliance",
				"installable": True,
				"latest_version": "17.1.0",
			}
		]
		self.task_result = {"status": "running"}
		self.install_result = {"task_id": "task-1"}
		self.contract_result = compatible_contract()
		self.audit_calls: list[tuple[str, str]] = []

	def installed_apps(self) -> set[str]:
		return self.apps

	def is_system_manager(self) -> bool:
		return self.manager

	def cloud_enabled(self) -> bool:
		return self.cloud

	def marketplace_apps(self) -> list[dict[str, object]]:
		return self.marketplace

	def task(self, _task_id: str) -> dict[str, object]:
		return self.task_result

	def install(self) -> dict[str, object]:
		if isinstance(self.install_result, Exception):
			raise self.install_result
		return self.install_result

	def contract(self) -> dict[str, object]:
		return self.contract_result

	def audit(self, status: str, detail: str) -> None:
		self.audit_calls.append((status, detail))


class FakeRepository:
	def __init__(self) -> None:
		self.contract_result = compatible_contract()
		self.rows = [
			{"hsn_code": "0101", "description": "Live horses", "modified": MODIFIED},
			{"hsn_code": "998313", "description": "Information technology services", "modified": MODIFIED},
		]

	def contract(self) -> dict[str, object]:
		return self.contract_result

	def metadata(self) -> dict[str, object]:
		return {
			"revision": "a" * 64,
			"sourceVersion": "17.1.0",
			"sourceModifiedAt": MODIFIED.isoformat(),
			"recordCount": len(self.rows),
		}

	def records(self) -> list[dict[str, object]]:
		return self.rows


class TestHsnDependency(UnitTestCase):
	def test_guest_and_non_manager_are_blocked(self) -> None:
		for manager in (False,):
			with self.subTest(manager=manager):
				runtime = FakeRuntime()
				runtime.manager = manager
				self.assertEqual(HsnDependencyService(runtime).get()["state"], "blocked")

	def test_admin_gets_safe_handoffs_for_missing_erpnext_and_unsupported_host(self) -> None:
		runtime = FakeRuntime()
		runtime.apps = set()
		missing_erpnext = HsnDependencyService(runtime).get()
		self.assertEqual(missing_erpnext["state"], "unsupported")
		self.assertEqual(missing_erpnext["adminHandoff"]["requiredApp"], "erpnext")

		runtime.apps = {"erpnext"}
		runtime.cloud = False
		self.assertEqual(HsnDependencyService(runtime).get()["state"], "unsupported")

	def test_cloud_admin_can_request_only_the_fixed_app_after_confirmation(self) -> None:
		runtime = FakeRuntime()
		service = HsnDependencyService(runtime)

		self.assertEqual(service.get()["state"], "installable")
		result = service.install(True)

		self.assertEqual(result["state"], "installing")
		self.assertEqual(result["taskId"], "task-1")
		self.assertEqual(runtime.audit_calls[0][0], "Success")
		self.assertIn("india_compliance", runtime.audit_calls[0][1])

	def test_install_rejects_missing_confirmation_and_non_manager(self) -> None:
		runtime = FakeRuntime()
		with self.assertRaises(frappe.ValidationError):
			HsnDependencyService(runtime).install(False)

		runtime.manager = False
		with self.assertRaises(frappe.PermissionError):
			HsnDependencyService(runtime).install(True)

	def test_failed_install_is_audited_and_retryable(self) -> None:
		runtime = FakeRuntime()
		runtime.install_result = RuntimeError("private upstream detail")

		with patch("frappe.log_error"):
			result = HsnDependencyService(runtime).install(True)

		self.assertEqual(result["state"], "failed")
		self.assertEqual(runtime.audit_calls, [("Failed", "The Frappe Cloud install request failed.")])
		self.assertNotIn("private", result["message"])

	def test_polling_reports_running_failure_and_successful_activation(self) -> None:
		runtime = FakeRuntime()
		service = HsnDependencyService(runtime)
		self.assertEqual(service.get("task-1")["state"], "installing")

		runtime.task_result = {"status": "failed"}
		self.assertEqual(service.get("task-1")["state"], "failed")

		runtime.apps.add("india_compliance")
		ready = service.get("task-1")
		self.assertEqual(ready["state"], "ready")
		self.assertTrue(ready["contract"]["compatible"])

	def test_incompatible_installed_schema_is_unsupported(self) -> None:
		runtime = FakeRuntime()
		runtime.apps.add("india_compliance")
		runtime.contract_result = {"compatible": False, "missingRequiredFields": ["description"]}
		self.assertEqual(HsnDependencyService(runtime).get()["state"], "unsupported")

	def test_dependency_endpoints_have_expected_access_and_http_methods(self) -> None:
		self.assertIn(get_dependency_status, frappe.guest_methods)
		self.assertNotIn(install_india_compliance, frappe.guest_methods)
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[get_dependency_status], ("GET", "QUERY")
		)
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[install_india_compliance], ("POST",)
		)


class TestHsnContract(UnitTestCase):
	def test_current_contract_requires_code_and_description_but_no_statutory_rate(self) -> None:
		fields = {
			"hsn_code": Mock(fieldtype="Data"),
			"description": Mock(fieldtype="Small Text"),
			"taxes": Mock(fieldtype="Table"),
		}
		meta = Mock()
		meta.get_field.side_effect = fields.get

		contract = inspect_hsn_contract(meta)

		self.assertTrue(contract["compatible"])
		self.assertEqual(contract["statutoryFields"], {})
		self.assertEqual(set(contract["missingStatutoryFields"]), set(MISSING_STATUTORY_FIELDS))
		self.assertIn("not an authoritative", contract["taxFieldNature"])


class TestHsnCatalog(UnitTestCase):
	def test_returns_versioned_public_catalog_and_honors_known_revision(self) -> None:
		repository = FakeRepository()
		service = HsnCatalogService(repository)

		catalog = service.get()
		unchanged = service.get("a" * 64)

		self.assertFalse(catalog["notModified"])
		self.assertEqual(catalog["recordCount"], 2)
		self.assertEqual(catalog["records"][0]["code"], "0101")
		self.assertNotIn("taxes", catalog["records"][0])
		self.assertNotIn("modifiedAt", catalog["records"][0])
		self.assertTrue(unchanged["notModified"])
		self.assertNotIn("records", unchanged)

	def test_exposes_a_future_contract_rate_only_when_the_field_exists(self) -> None:
		repository = FakeRepository()
		repository.contract_result["statutoryFields"] = {"gstRate": "gst_rate"}
		repository.rows[0]["gst_rate"] = 12

		catalog = HsnCatalogService(repository).get()

		self.assertEqual(catalog["records"][0]["gstRate"], 12.0)
		self.assertNotIn("gstRate", catalog["records"][1])

	def test_rejects_missing_contract_and_malformed_master_rows(self) -> None:
		repository = FakeRepository()
		repository.contract_result = {"compatible": False}
		with self.assertRaises(frappe.ValidationError):
			HsnCatalogService(repository).get()

		repository.contract_result = compatible_contract()
		repository.rows[0]["hsn_code"] = "01<script>"
		with self.assertRaises(frappe.ValidationError):
			HsnCatalogService(repository).get()

	def test_catalog_endpoint_is_guest_get_only(self) -> None:
		self.assertIn(get_hsn_catalog, frappe.guest_methods)
		self.assertEqual(
			frappe.allowed_http_methods_for_whitelisted_func[get_hsn_catalog], ("GET", "QUERY")
		)


def compatible_contract() -> dict[str, object]:
	return {
		"compatible": True,
		"availableFields": ["hsn_code", "description", "taxes"],
		"missingRequiredFields": [],
		"missingStatutoryFields": list(MISSING_STATUTORY_FIELDS),
		"statutoryFields": {},
	}
