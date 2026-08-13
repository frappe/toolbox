# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

from contextlib import contextmanager
from types import SimpleNamespace

import frappe
from frappe.tests import UnitTestCase

from toolbox import seo
from toolbox.routes import TOOL_ROUTES
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
		with requested("/dictionary"):
			context = get_context()

		self.assertEqual(context.seo["title"], seo.PAGES["/dictionary"].title)
		self.assertTrue(context.seo["canonical"].endswith("/dictionary"))

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
		self.assertEqual(titles["/dictionary"], seo.PAGES["/dictionary"].title)


class TestServerRenderedContent(UnitTestCase):
	"""A crawler runs no JavaScript, so the page carries its heading and its content already."""

	def test_every_page_is_given_its_heading(self):
		"""The heading comes from seo.py, so a page that is not a tool has one too."""
		for path, name in (("/dictionary", "Dictionary"), ("/data-sources", "Data Sources"), ("", "All Tools")):
			with self.subTest(path=path):
				with requested(path):
					self.assertEqual(get_context().seo["name"], name)

	def test_the_root_is_given_a_link_to_every_tool(self):
		"""A crawler that runs no JavaScript reads an empty body at the root otherwise."""
		with requested(""):
			links = get_context().seo["tool_links"]
		with requested("/dictionary"):
			self.assertEqual(get_context().seo["tool_links"], [])

		self.assertEqual(len(links), len(TOOL_ROUTES))
		self.assertIn({"name": "Dictionary", "path": "/dictionary"}, links)

	def test_a_written_page_carries_its_content(self):
		with requested("/emi-calculator"):
			content = get_context().page_content

		self.assertIn("Frequently asked questions", content.content)
		self.assertTrue(content.faqs)

	def test_two_routes_do_not_share_content(self):
		with requested("/calculator"):
			calculator = get_context().page_content
		with requested("/emi-calculator"):
			emi = get_context().page_content

		self.assertNotEqual(calculator.content, emi.content)

	def test_a_page_without_content_renders_none(self):
		"""The template asks whether there is content. An empty block is not the same as none."""
		with requested("/settings"):
			self.assertIsNone(get_context().page_content)
		with requested(""):
			self.assertIsNone(get_context().page_content)
