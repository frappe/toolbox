import importlib.util
from pathlib import Path
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

# refresh_datasets is a standalone CI script (no Frappe import); load it by path.
_SCRIPT = Path(frappe.get_app_path("toolbox")).parent / "scripts" / "refresh_datasets.py"
_spec = importlib.util.spec_from_file_location("refresh_datasets", _SCRIPT)
refresh_datasets = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(refresh_datasets)


def _source(version):
	return lambda: {
		"version": version,
		"sourceUpdatedAt": version,
		"fetch": lambda directory: directory / "asset",
	}


class TestRefreshDatasets(UnitTestCase):
	def test_check_flags_only_stale_sources(self) -> None:
		manifest = {"datasets": {"IFSC": {"version": "v1"}, "HSN": {"version": "2024-06-25"}}}
		with (
			patch.object(refresh_datasets, "SOURCES", {"IFSC": _source("v2"), "HSN": _source("2024-06-25")}),
			patch.object(refresh_datasets, "_load_manifest", return_value=manifest),
		):
			self.assertEqual(refresh_datasets.check(), ["IFSC"])

	def test_refresh_skips_current_and_publishes_stale(self) -> None:
		manifest = {"datasets": {"IFSC": {"version": "v2"}, "HSN": {"version": "old"}}}
		with (
			patch.object(refresh_datasets, "SOURCES", {"IFSC": _source("v2"), "HSN": _source("new")}),
			patch.object(refresh_datasets, "_load_manifest", return_value=manifest),
			patch.object(refresh_datasets.publish_dataset, "publish") as publish,
		):
			changed = refresh_datasets.refresh(["IFSC", "HSN"])
		self.assertEqual(changed, ["HSN"])
		publish.assert_called_once()
		self.assertEqual(publish.call_args[0][0], "HSN")
