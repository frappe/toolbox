import gzip
import hashlib
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from toolbox import dataset_sync
from toolbox.dataset_distribution import DatasetDistributionError, _validate_url, download_asset
from toolbox.india_business_data import PIN_DOCTYPE, RELEASE_DOCTYPE

SMALL_PIN_CSV = (
	"pincode,officename,officetype,delivery,district,statename\n"
	"560001,Bengaluru G.P.O.,HO,Delivery,Bengaluru,Karnataka\n"
	"110001,New Delhi G.P.O.,HO,Delivery,Central Delhi,Delhi\n"
)


class TestDatasetSyncUnit(UnitTestCase):
	def test_load_manifest_returns_none_when_absent(self) -> None:
		with patch.object(dataset_sync, "manifest_path", return_value=Path("/no/such/manifest.json")):
			self.assertIsNone(dataset_sync.load_manifest())

	def test_load_manifest_rejects_wrong_schema(self) -> None:
		with TemporaryDirectory() as directory:
			path = Path(directory) / "manifest.json"
			path.write_text('{"schemaVersion": 2, "datasets": {}}', encoding="utf-8")
			with patch.object(dataset_sync, "manifest_path", return_value=path):
				self.assertIsNone(dataset_sync.load_manifest())

	def test_sync_one_skips_when_active_version_matches(self) -> None:
		with (
			patch.object(dataset_sync, "_active_version", return_value="v1") as active,
			patch.object(dataset_sync, "_install") as install,
		):
			outcome = dataset_sync._sync_one("PIN", {"version": "v1"}, force=False)
		self.assertEqual(outcome, "skipped")
		active.assert_called_once()
		install.assert_not_called()

	def test_sync_one_installs_when_version_differs(self) -> None:
		with (
			patch.object(dataset_sync, "_active_version", return_value="old"),
			patch.object(dataset_sync, "_install") as install,
		):
			outcome = dataset_sync._sync_one("PIN", {"version": "new"}, force=False)
		self.assertEqual(outcome, "synced")
		install.assert_called_once()

	def test_sync_datasets_isolates_a_failing_dataset(self) -> None:
		manifest = {"schemaVersion": 1, "datasets": {"PIN": {"version": "a"}, "IFSC": {"version": "b"}}}

		def fake_sync_one(dataset_type, entry, force):
			if dataset_type == "PIN":
				raise ValueError("boom")
			return "synced"

		with (
			patch.object(dataset_sync, "load_manifest", return_value=manifest),
			patch.object(dataset_sync, "_sync_one", side_effect=fake_sync_one),
		):
			results = dataset_sync.sync_datasets()
		self.assertEqual(results["failed"], ["PIN"])
		self.assertEqual(results["synced"], ["IFSC"])

	def test_validate_url_allows_https_and_loopback_http_only(self) -> None:
		_validate_url("https://example.com/a.gz")
		_validate_url("http://127.0.0.1:8000/a.gz")
		_validate_url("http://localhost:9000/a.gz")
		for bad in ("http://example.com/a.gz", "ftp://example.com/a.gz", "file:///etc/passwd", ""):
			with self.subTest(url=bad), self.assertRaises(DatasetDistributionError):
				_validate_url(bad)

	def test_decompress_gzip_roundtrip(self) -> None:
		with TemporaryDirectory() as directory:
			asset = Path(directory) / "asset"
			with gzip.open(asset, "wb") as handle:
				handle.write(b"hello world")
			result = dataset_sync._decompress(asset, {"compression": "gzip"})
			self.assertEqual(result.read_bytes(), b"hello world")


class TestDatasetSyncIntegration(IntegrationTestCase):
	def setUp(self) -> None:
		self._purge()

	def tearDown(self) -> None:
		self._purge()

	@staticmethod
	def _purge() -> None:
		# Scope teardown to PIN only so a shared test site keeps its IFSC/Dictionary data.
		frappe.db.rollback()
		frappe.db.delete(PIN_DOCTYPE)
		frappe.db.delete(RELEASE_DOCTYPE, {"dataset_type": "PIN"})
		frappe.db.commit()

	def test_full_pipeline_downloads_verifies_and_imports(self) -> None:
		with TemporaryDirectory() as directory:
			entry = self._make_asset(Path(directory), SMALL_PIN_CSV)
			with self._serve(directory) as base_url:
				entry["url"] = f"{base_url}/pin.csv.gz"
				manifest = {"schemaVersion": 1, "datasets": {"PIN": entry}}
				with patch.object(dataset_sync, "load_manifest", return_value=manifest):
					results = dataset_sync.sync_datasets(force=True)

		self.assertEqual(results["synced"], ["PIN"])
		active = frappe.db.get_value(
			RELEASE_DOCTYPE, {"dataset_type": "PIN", "status": "Active"}, ["version", "record_count"], as_dict=True
		)
		self.assertEqual(active.version, "test-1")
		self.assertEqual(active.record_count, 2)
		self.assertTrue(frappe.db.exists(PIN_DOCTYPE, {"pin_code": "560001"}))

	def test_checksum_mismatch_fails_without_activating(self) -> None:
		with TemporaryDirectory() as directory:
			entry = self._make_asset(Path(directory), SMALL_PIN_CSV)
			entry["sha256"] = "0" * 64  # wrong on purpose
			with self._serve(directory) as base_url:
				entry["url"] = f"{base_url}/pin.csv.gz"
				manifest = {"schemaVersion": 1, "datasets": {"PIN": entry}}
				with patch.object(dataset_sync, "load_manifest", return_value=manifest):
					results = dataset_sync.sync_datasets(force=True)

		self.assertEqual(results["failed"], ["PIN"])
		self.assertFalse(frappe.db.exists(RELEASE_DOCTYPE, {"dataset_type": "PIN", "status": "Active"}))

	def test_download_asset_rejects_a_tampered_file(self) -> None:
		with TemporaryDirectory() as directory:
			self._make_asset(Path(directory), SMALL_PIN_CSV)
			with self._serve(directory) as base_url:
				dest = Path(directory) / "out"
				with self.assertRaises(DatasetDistributionError):
					download_asset(f"{base_url}/pin.csv.gz", "a" * 64, dest)

	@staticmethod
	def _make_asset(directory: Path, content: str) -> dict:
		asset = directory / "pin.csv.gz"
		with gzip.open(asset, "wb") as handle:
			handle.write(content.encode("utf-8"))
		checksum = hashlib.sha256(asset.read_bytes()).hexdigest()
		return {
			"version": "test-1",
			"sourceUpdatedAt": "2026-01-01",
			"sha256": checksum,
			"format": "csv",
			"compression": "gzip",
		}

	@staticmethod
	def _serve(directory: str):
		handler = partial(SimpleHTTPRequestHandler, directory=directory)
		server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
		thread = threading.Thread(target=server.serve_forever, daemon=True)
		thread.start()

		class _Server:
			def __enter__(self) -> str:
				return f"http://127.0.0.1:{server.server_address[1]}"

			def __exit__(self, *_exc) -> None:
				server.shutdown()
				server.server_close()

		return _Server()
