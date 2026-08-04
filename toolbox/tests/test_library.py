# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import frappe
from frappe.tests import IntegrationTestCase

from toolbox.library import (
	delete_collection,
	delete_link,
	export_links,
	get_link,
	list_collections,
	list_links,
	normalise_url,
	save_collection,
	save_link,
	set_status,
	toggle_favourite,
)

USER_A = "library-a@example.com"
USER_B = "library-b@example.com"


class TestLibraryUrlNormalisation(IntegrationTestCase):
	def test_scheme_is_added_for_bare_hosts(self):
		self.assertEqual(normalise_url("example.com/path"), "https://example.com/path")
		self.assertEqual(normalise_url("//example.com/path"), "https://example.com/path")

	def test_host_is_lowercased_but_path_and_query_kept(self):
		self.assertEqual(
			normalise_url("HTTP://EXAMPLE.com/Path?b=2&a=1"),
			"http://example.com/Path?b=2&a=1",
		)

	def test_default_ports_are_stripped(self):
		self.assertEqual(normalise_url("http://example.com:80/x"), "http://example.com/x")
		self.assertEqual(normalise_url("https://example.com:443/x"), "https://example.com/x")

	def test_non_default_port_is_kept(self):
		self.assertEqual(normalise_url("https://example.com:8443/x"), "https://example.com:8443/x")
		self.assertEqual(normalise_url("example.com:8080/x"), "https://example.com:8080/x")

	def test_fragment_is_removed(self):
		self.assertEqual(normalise_url("https://example.com/a#section"), "https://example.com/a")

	def test_trailing_slash_is_normalised(self):
		self.assertEqual(normalise_url("https://example.com/"), "https://example.com")
		self.assertEqual(normalise_url("https://example.com/a/"), "https://example.com/a")

	def test_query_is_kept_because_it_can_identify_a_resource(self):
		self.assertEqual(normalise_url("https://example.com/watch?v=abc"), "https://example.com/watch?v=abc")

	def test_javascript_scheme_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			normalise_url("javascript:alert(1)")

	def test_data_and_file_schemes_are_rejected(self):
		for bad in ("data:text/html,<b>x</b>", "file:///etc/passwd", "ftp://example.com/x"):
			with self.assertRaises(frappe.ValidationError):
				normalise_url(bad)

	def test_embedded_credentials_are_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			normalise_url("https://user:pass@example.com/x")

	def test_empty_url_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			normalise_url("   ")


class TestLibrary(IntegrationTestCase):
	def setUp(self):
		for email in (USER_A, USER_B):
			_ensure_user(email)
		# Integration tests in a class share one transaction, so start each test from a clean
		# slate — these suites reuse the same URLs and assert exact counts + duplicate detection.
		for doctype in ("Toolbox Saved Link", "Toolbox Link Collection"):
			frappe.db.delete(doctype, {"owner": ["in", [USER_A, USER_B]]})
		frappe.set_user(USER_A)
		self.addCleanup(lambda: frappe.set_user("Administrator"))

	def _save(self, **data):
		return save_link(frappe.as_json(data))

	def test_save_computes_normalised_url_and_domain(self):
		saved = self._save(url="HTTPS://Example.com/Article/", title="An article")
		self.assertTrue(saved["saved"])
		self.assertEqual(saved["normalised_url"], "https://example.com/Article")
		self.assertEqual(saved["domain"], "example.com")
		self.assertEqual(get_link(saved["name"])["title"], "An article")

	def test_javascript_url_is_rejected_on_save(self):
		with self.assertRaises(frappe.ValidationError):
			self._save(url="javascript:alert(document.cookie)", title="xss")

	def test_duplicate_detection_returns_hint_without_saving(self):
		first = self._save(url="https://example.com/post", title="Original")
		self.assertTrue(first["saved"])

		dup = self._save(url="https://example.com/post/", title="Second copy")
		self.assertFalse(dup["saved"])
		self.assertEqual(dup["duplicate_of"], first["name"])
		# Only the original exists; the duplicate was not persisted.
		self.assertEqual(len(list_links()), 1)

	def test_duplicate_can_be_saved_when_explicitly_allowed(self):
		self._save(url="https://example.com/post", title="Original")
		dup = self._save(url="https://example.com/post", title="Deliberate copy", allow_duplicate=True)
		self.assertTrue(dup["saved"])
		self.assertEqual(len(list_links()), 2)

	def test_update_keeps_a_link_from_flagging_itself_as_duplicate(self):
		saved = self._save(url="https://example.com/post", title="First")
		updated = self._save(name=saved["name"], url="https://example.com/post", title="Renamed")
		self.assertTrue(updated["saved"])
		self.assertEqual(updated["title"], "Renamed")

	def test_status_change(self):
		saved = self._save(url="https://example.com/x", title="Read me")
		self.assertEqual(saved["status"], "Inbox")
		moved = set_status(saved["name"], "Read")
		self.assertEqual(moved["status"], "Read")

	def test_toggle_favourite(self):
		saved = self._save(url="https://example.com/x")
		self.assertFalse(saved["is_favourite"])
		self.assertTrue(toggle_favourite(saved["name"])["is_favourite"])
		self.assertFalse(toggle_favourite(saved["name"])["is_favourite"])

	def test_tags_are_deduped_case_insensitively(self):
		saved = self._save(url="https://example.com/x", tags=["news", "News", "tech"])
		self.assertEqual(saved["tags"], ["news", "tech"])

	def test_list_filters_by_status_and_search(self):
		self._save(url="https://example.com/inbox", title="Inbox item")
		read = self._save(url="https://example.com/read", title="Finished")
		set_status(read["name"], "Read")

		self.assertEqual([r["title"] for r in list_links(status="Read")], ["Finished"])
		self.assertEqual([r["title"] for r in list_links(search="Inbox")], ["Inbox item"])

	def test_list_filters_by_collection_and_tag(self):
		self._save(url="https://example.com/a", title="A", collection="Work", tags=["urgent"])
		self._save(url="https://example.com/b", title="B", collection="Home")

		self.assertEqual([r["title"] for r in list_links(collection="Work")], ["A"])
		self.assertEqual([r["title"] for r in list_links(tag="urgent")], ["A"])

	def test_export_returns_json_and_csv_rows(self):
		self._save(url="https://example.com/x", title="Exported", tags=["a", "b"])
		export = export_links()
		self.assertEqual(len(export["links"]), 1)
		self.assertIn("url", export["csv_columns"])
		self.assertEqual(export["csv_rows"][0][0], "https://example.com/x")

	def test_collections_crud(self):
		created = save_collection(frappe.as_json({"collection_name": "Reading"}))
		self.assertEqual(created["collection_name"], "Reading")
		self.assertEqual([c["collection_name"] for c in list_collections()], ["Reading"])
		delete_collection(created["name"])
		self.assertEqual(list_collections(), [])

	def test_owner_cannot_read_or_delete_another_users_link(self):
		mine = self._save(url="https://example.com/secret", title="Private")
		frappe.set_user(USER_B)
		self.assertEqual(list_links(), [])
		with self.assertRaises(frappe.PermissionError):
			get_link(mine["name"])
		with self.assertRaises(frappe.PermissionError):
			delete_link(mine["name"])


def _ensure_user(email: str) -> None:
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Library",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)
