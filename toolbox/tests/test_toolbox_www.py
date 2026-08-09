# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from contextlib import contextmanager
from types import SimpleNamespace

import frappe
from frappe.tests import UnitTestCase

from toolbox import seo
from toolbox.www.toolbox import get_context


TEST_HOST = "toolbox.localhost"


@contextmanager
def requested(path):
	"""Serve one request path, the way Frappe does before the route map rewrites it.

	The stub carries `host` and `headers` as well as `path`, because `frappe.utils.get_url`
	reads both to work out the site's own origin. A stub that answers fewer questions than the
	real request turns this suite green over a page that cannot render.
	"""
	previous = getattr(frappe.local, "request", None)
	frappe.local.request = SimpleNamespace(path=path, host=TEST_HOST, headers={})
	try:
		yield
	finally:
		frappe.local.request = previous


class TestToolboxWebEntry(UnitTestCase):
	"""The Toolbox web entry is open to everyone and identifies nobody."""

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_guest_receives_the_app(self):
		frappe.set_user("Guest")
		context = get_context()
		self.assertIn("csrf_token", context.boot)
		self.assertEqual(context.no_cache, 1)

	def test_boot_carries_no_identity(self):
		"""A page that names its visitor invites code that branches on who they are."""
		frappe.set_user("Guest")
		guest_boot = get_context().boot

		frappe.set_user("Administrator")
		admin_boot = get_context().boot

		for key in ("user", "full_name", "is_logged_in"):
			self.assertNotIn(key, guest_boot)
			self.assertNotIn(key, admin_boot)

		self.assertEqual(set(guest_boot), set(admin_boot))


class TestServerRenderedMetadata(UnitTestCase):
	"""One template serves every route, so the head has to come from the path that was asked for."""

	def test_the_head_describes_the_requested_tool(self):
		with requested("/weather"):
			context = get_context()

		self.assertEqual(context.seo["title"], seo.PAGES["/weather"].title)
		self.assertTrue(context.seo["canonical"].endswith("/weather"))

	def test_two_routes_do_not_share_a_head(self):
		"""The whole change exists because every route used to answer with the same title."""
		with requested("/calculator"):
			calculator = get_context().seo
		with requested("/dictionary"):
			dictionary = get_context().seo

		self.assertNotEqual(calculator["title"], dictionary["title"])
		self.assertNotEqual(calculator["description"], dictionary["description"])
		self.assertNotEqual(calculator["canonical"], dictionary["canonical"])

	def test_the_root_is_served_without_a_request_path(self):
		with requested(""):
			context = get_context()

		self.assertEqual(context.seo["title"], seo.PAGES["/"].title)

	def test_the_client_is_given_the_server_titles(self):
		"""An in-app navigation brings no new server response, so the client repeats these."""
		with requested("/"):
			titles = get_context().boot["toolbox_page_titles"]

		self.assertEqual(titles, seo.route_titles())
		self.assertEqual(titles["/weather"], seo.PAGES["/weather"].title)
