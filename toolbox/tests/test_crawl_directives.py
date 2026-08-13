# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import xml.etree.ElementTree as ElementTree
from pathlib import Path
from urllib.robotparser import RobotFileParser

import frappe
from frappe.tests import UnitTestCase

from toolbox import seo
from toolbox.routes import TOOL_ROUTES
from toolbox.www import robots, sitemap

WWW = Path(frappe.get_app_path("toolbox")) / "www"
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def render(name, context):
	return frappe.render_template((WWW / name).read_text(), context)


class TestSitemap(UnitTestCase):
	"""The sitemap Frappe serves before this file existed listed Frappe's own /about and
	/contact, and not one Toolbox tool."""

	def locations(self):
		document = ElementTree.fromstring(render("sitemap.xml", sitemap.get_context(frappe._dict())))
		return [url.find(f"{SITEMAP_NS}loc").text for url in document.findall(f"{SITEMAP_NS}url")]

	def test_every_tool_is_listed(self):
		locations = self.locations()

		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				self.assertTrue(
					any(location.endswith(f"/{route}") for location in locations),
					f"/{route} is missing from the sitemap",
				)

	def test_the_root_is_listed_once(self):
		self.assertEqual(len([location for location in self.locations() if location.endswith("/")]), 1)

	def test_a_page_asked_to_stay_out_of_the_index_is_not_offered(self):
		"""Telling a crawler to skip a page and then advertising it is a contradiction."""
		self.assertFalse(any(location.endswith("/settings") for location in self.locations()))

	def test_the_count_matches_what_seo_declares_indexable(self):
		self.assertEqual(len(self.locations()), len(seo.indexable_routes()))

	def test_locations_are_absolute(self):
		for location in self.locations():
			with self.subTest(location=location):
				self.assertTrue(location.startswith("http"))

	def test_it_is_valid_xml_and_claims_no_dates(self):
		"""Frappe's sitemap stamps every page with today's date, every day.

		A date that is always wrong is worse than no date, because a crawler that stops trusting
		it discounts the real ones later.
		"""
		rendered = render("sitemap.xml", sitemap.get_context(frappe._dict()))

		ElementTree.fromstring(rendered)
		self.assertNotIn("lastmod", rendered)


class TestRobots(UnitTestCase):
	"""Frappe answers /robots.txt from a Website Settings field, which is empty on this site."""

	def rules(self):
		parser = RobotFileParser()
		parser.parse(render("robots.txt", robots.get_context(frappe._dict())).splitlines())
		return parser

	def test_every_tool_may_be_crawled(self):
		rules = self.rules()

		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				self.assertTrue(rules.can_fetch("*", f"/{route}"))

	def test_frappe_s_own_surfaces_are_not_crawled(self):
		rules = self.rules()

		self.assertFalse(rules.can_fetch("*", "/api/method/toolbox.dictionary.lookup"))
		self.assertFalse(rules.can_fetch("*", "/app/user"))

	def test_settings_stays_crawlable_so_its_noindex_is_read(self):
		"""A disallowed page is never fetched, so its noindex is never seen. Settings is linked
		from the navigation, so the URL could still surface with no description at all."""
		self.assertTrue(self.rules().can_fetch("*", "/settings"))

	def test_it_points_at_the_sitemap(self):
		self.assertEqual(self.rules().site_maps(), [frappe.utils.get_url("/sitemap.xml")])

	def test_it_declares_no_blanket_allow(self):
		"""Google resolves a conflict by longest match, but several parsers take the first.

		Under those, a leading `Allow: /` wins every comparison and every Disallow below it
		stops meaning anything. This is the regression guard for putting one back.
		"""
		rendered = render("robots.txt", robots.get_context(frappe._dict()))
		directives = [
			line.split(":", 1)[0].strip().lower()
			for line in rendered.splitlines()
			if line.strip() and not line.startswith("#")
		]

		self.assertNotIn("allow", directives)
