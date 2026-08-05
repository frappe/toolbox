# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import base64
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.audio import (
	ASSET,
	delete_recording,
	detect_audio_format,
	list_recordings,
	save_recording,
	update_recording,
)

USER_A = "audio-a@example.com"
USER_B = "audio-b@example.com"

# Minimal but valid-by-magic-bytes fixtures.
WAV = b"RIFF\x24\x00\x00\x00WAVE" + b"fmt \x10\x00\x00\x00" + b"\x00" * 16
OGG = b"OggS" + b"\x00" * 24
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 20
MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 8
NOT_AUDIO = b"<html>hello this is not audio at all</html>"


def _b64(content):
	return base64.b64encode(content).decode()


class TestDetectAudioFormat(IntegrationTestCase):
	def test_recognised_containers(self):
		self.assertEqual(detect_audio_format(WAV[:16]), "wav")
		self.assertEqual(detect_audio_format(OGG[:16]), "ogg")
		self.assertEqual(detect_audio_format(WEBM[:16]), "webm")
		self.assertEqual(detect_audio_format(MP3[:16]), "mp3")
		self.assertEqual(detect_audio_format(b"fLaC" + b"\x00" * 12), "flac")
		self.assertEqual(detect_audio_format(b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 4), "mp4")

	def test_rejects_non_audio_and_short(self):
		self.assertIsNone(detect_audio_format(NOT_AUDIO[:16]))
		self.assertIsNone(detect_audio_format(b"RIFF"))  # too short


class TestAudioLibrary(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		frappe.set_user("Administrator")
		for email in (USER_A, USER_B):
			for name in frappe.get_all(ASSET, filters={"owner": email}, pluck="name"):
				frappe.delete_doc(ASSET, name, ignore_permissions=True, force=True)
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def _save(self, content=WAV, **data):
		data.setdefault("title", "Memo")
		data["data"] = _b64(content)
		return save_recording(frappe.as_json(data))

	def test_save_creates_asset_and_private_file(self):
		saved = self._save(duration_seconds=3.5)
		self.assertTrue(saved["name"])
		self.assertEqual(saved["container_format"], "wav")
		self.assertEqual(saved["file_size"], len(WAV))
		self.assertTrue(saved["file"].startswith("/private/files/"))
		self.assertTrue(frappe.db.exists("File", {"file_url": saved["file"]}))

	def test_rejects_non_audio_payload(self):
		with self.assertRaises(frappe.ValidationError):
			self._save(content=NOT_AUDIO)

	def test_rejects_empty_and_bad_base64(self):
		with self.assertRaises(frappe.ValidationError):
			save_recording(frappe.as_json({"title": "x", "data": ""}))

	def test_rejects_oversize(self):
		with patch("toolbox.audio.MAX_AUDIO_BYTES", 8):
			with self.assertRaises(frappe.ValidationError):
				self._save()

	def test_data_url_prefix_is_stripped(self):
		saved = save_recording(frappe.as_json({"title": "Prefixed", "data": "data:audio/wav;base64," + _b64(WAV)}))
		self.assertEqual(saved["container_format"], "wav")

	def test_update_renames_and_retags(self):
		saved = self._save()
		updated = update_recording(frappe.as_json({"name": saved["name"], "title": "Renamed", "tags": ["voice", "Voice"]}))
		self.assertEqual(updated["title"], "Renamed")
		self.assertEqual(updated["tags"], ["voice"])

	def test_delete_removes_asset_and_file(self):
		saved = self._save()
		file_url = saved["file"]
		delete_recording(saved["name"])
		self.assertFalse(frappe.db.exists(ASSET, saved["name"]))
		self.assertFalse(frappe.db.exists("File", {"file_url": file_url}))

	def test_owner_isolation(self):
		mine = self._save()
		frappe.set_user(USER_B)
		self.assertEqual(list_recordings(), [])
		with self.assertRaises(frappe.PermissionError):
			delete_recording(mine["name"])


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Audio",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
