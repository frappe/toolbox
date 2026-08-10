# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import json
from pathlib import Path

import frappe
from frappe.tests import UnitTestCase

from toolbox import seo, tool_content
from toolbox.routes import TOOL_ROUTES

BASE_URL = "https://frappe.tools"

# The head block the build injects into toolbox/www/toolbox.html. The generated page is
# gitignored, so the tests read the template it is built from.
HEAD_TEMPLATE = (
	Path(frappe.get_app_path("toolbox")).parent / "frontend" / "build" / "server-meta.template.html"
)

# Google truncates a title at roughly 60 characters and a description at roughly 160. A longer
# one is not rejected, it is cut, and the cut falls wherever it falls.
MAX_TITLE = 60
MAX_DESCRIPTION = 160
# Short enough to say nothing. A description this brief loses to the snippet Google writes itself.
MIN_DESCRIPTION = 70


class TestPageCoverage(UnitTestCase):
	"""Every route Frappe serves is described, and nothing else is."""

	def test_pages_match_the_routes_frappe_serves(self):
		"""A tool added to routes.py and forgotten here inherits another page's title.

		Nothing else fails when that happens: the route works, the tool works, and the page
		claims to be something it is not.
		"""
		self.assertEqual(set(seo.PAGES), seo.served_routes())

	def test_every_tool_route_is_described(self):
		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				page = seo.PAGES[f"/{route}"]
				self.assertTrue(page.indexable)
				self.assertIsNotNone(page.application_category)

	def test_titles_are_unique(self):
		"""Two pages with one title are two pages competing for the same result."""
		titles = [page.title for page in seo.PAGES.values()]
		self.assertEqual(len(titles), len(set(titles)))

	def test_copy_fits_a_search_result(self):
		for route, page in seo.PAGES.items():
			with self.subTest(route=route):
				self.assertLessEqual(len(page.title), MAX_TITLE)
				self.assertLessEqual(len(page.description), MAX_DESCRIPTION)
				self.assertGreaterEqual(len(page.description), MIN_DESCRIPTION)


class TestPageMetadata(UnitTestCase):
	"""The head Frappe renders for one route."""

	def test_a_tool_names_itself(self):
		metadata = seo.page_metadata("/weather", BASE_URL)

		self.assertEqual(metadata["title"], seo.PAGES["/weather"].title)
		self.assertEqual(metadata["canonical"], "https://frappe.tools/weather")
		self.assertEqual(metadata["robots"], "index, follow")
		self.assertEqual(metadata["image"], f"{BASE_URL}{seo.CARD_IMAGE}")

	def test_settings_is_not_indexed(self):
		metadata = seo.page_metadata("/settings", BASE_URL)

		self.assertEqual(metadata["robots"], "noindex, follow")
		# Structured data for a page a crawler is asked to skip is only a contradiction.
		self.assertEqual(metadata["structured_data"], "")

	def test_the_path_frappe_passes_is_accepted_in_every_shape(self):
		"""Frappe drops the leading slash for a route rule and passes an empty path for the root."""
		for path in ("/weather", "weather", "/weather/", " /weather "):
			with self.subTest(path=path):
				self.assertEqual(seo.page_metadata(path, BASE_URL)["title"], seo.PAGES["/weather"].title)

		for path in ("", "/"):
			with self.subTest(path=path):
				self.assertEqual(seo.page_metadata(path, BASE_URL)["title"], seo.PAGES["/"].title)

	def test_an_unknown_path_still_gets_a_head(self):
		"""A head that is wrong beats a head that is missing, and a broken canonical is worse."""
		metadata = seo.page_metadata("/not-a-tool", BASE_URL)

		self.assertEqual(metadata["title"], seo.PAGES["/"].title)
		self.assertEqual(metadata["canonical"], "https://frappe.tools/")

	def test_the_canonical_follows_the_host_that_was_asked(self):
		"""A preview deployment declares itself canonical rather than pointing at production."""
		metadata = seo.page_metadata("/calculator", "https://toolbox.localhost:8100")

		self.assertEqual(metadata["canonical"], "https://toolbox.localhost:8100/calculator")

	def test_every_route_has_a_title_for_the_client(self):
		self.assertEqual(set(seo.route_titles()), set(seo.PAGES))


class TestStructuredData(UnitTestCase):
	"""The JSON-LD a crawler reads."""

	def test_the_root_describes_the_site_and_lists_the_tools(self):
		documents = json.loads(seo.page_metadata("/", BASE_URL)["structured_data"])

		self.assertEqual([document["@type"] for document in documents], ["WebSite", "ItemList"])

		tool_list = documents[1]
		self.assertEqual(tool_list["numberOfItems"], len(TOOL_ROUTES))
		self.assertEqual(
			[item["url"] for item in tool_list["itemListElement"]],
			[f"{BASE_URL}/{route}" for route in TOOL_ROUTES],
		)
		self.assertEqual(
			[item["position"] for item in tool_list["itemListElement"]],
			list(range(1, len(TOOL_ROUTES) + 1)),
		)

	def test_a_tool_describes_itself_and_its_place(self):
		documents = json.loads(seo.page_metadata("/gst-calculator", BASE_URL)["structured_data"])

		self.assertEqual(
			[document["@type"] for document in documents], ["WebApplication", "BreadcrumbList"]
		)

		application = documents[0]
		self.assertEqual(application["url"], f"{BASE_URL}/gst-calculator")
		self.assertEqual(application["applicationCategory"], "FinanceApplication")
		# The price is stated rather than implied. It is what puts the word free in a result.
		self.assertEqual(application["offers"]["price"], "0")

		breadcrumb = documents[1]["itemListElement"]
		self.assertEqual(
			[step["item"] for step in breadcrumb],
			[f"{BASE_URL}/", f"{BASE_URL}/gst-calculator"],
		)

	def test_every_tool_produces_valid_json(self):
		"""Every tool describes itself and its place, and adds what its written page carries."""
		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				documents = json.loads(seo.page_metadata(f"/{route}", BASE_URL)["structured_data"])
				types = [document["@type"] for document in documents]

				self.assertEqual(types[:2], ["WebApplication", "BreadcrumbList"])
				self.assertLessEqual(set(types[2:]), {"FAQPage", "HowTo"})

	def test_a_description_cannot_end_the_script_element(self):
		"""The copy carries no closing tag today. Escaping means a later one cannot become markup."""
		encoded = seo.as_json_ld([{"description": "</script><img src=x>"}])

		self.assertNotIn("<", encoded)
		self.assertEqual(json.loads(encoded)["description"], "</script><img src=x>")

	def test_nothing_to_say_renders_nothing(self):
		self.assertEqual(seo.as_json_ld([]), "")


class TestContentStructuredData(UnitTestCase):
	"""The questions and the steps a written page carries are described to a search engine."""

	def documents(self, route):
		return json.loads(seo.page_metadata(route, BASE_URL)["structured_data"])

	def test_a_written_page_describes_its_questions(self):
		faq = next(
			document for document in self.documents("/emi-calculator") if document["@type"] == "FAQPage"
		)
		content = tool_content.page_content("/emi-calculator")

		self.assertEqual(len(faq["mainEntity"]), len(content.faqs))
		for question, written in zip(faq["mainEntity"], content.faqs, strict=True):
			self.assertEqual(question["name"], written.question)
			self.assertEqual(question["acceptedAnswer"]["text"], written.answer)

	def test_a_written_page_describes_its_steps(self):
		how_to = next(
			document for document in self.documents("/emi-calculator") if document["@type"] == "HowTo"
		)

		self.assertEqual(
			[step["text"] for step in how_to["step"]],
			list(tool_content.page_content("/emi-calculator").steps),
		)

	def test_a_page_that_is_not_written_describes_no_questions(self):
		"""Structured data has to describe what the page says, and an empty page says nothing."""
		types = [document["@type"] for document in self.documents("/pace-calculator")]

		self.assertNotIn("FAQPage", types)
		self.assertNotIn("HowTo", types)


class TestHeadEscaping(UnitTestCase):
	"""The site's own origin reaches the head, and a visitor chooses it.

	`frappe.utils.get_url` reads `request.host`, which is the HTTP Host header. A request can
	carry any Host, so the origin is untrusted input in both places it lands: an HTML attribute,
	and a raw `<script type="application/ld+json">` block. Frappe's Jinja environment does not
	autoescape, so nothing is escaped unless this template escapes it.

	These render the real template rather than asserting on the filters in it, because the
	property that matters is what reaches the browser.
	"""

	HOSTILE = 'https://evil.test/"><script>alert(1)</script>'

	def render(self, path):
		return frappe.render_template(
			HEAD_TEMPLATE.read_text(), {"seo": seo.page_metadata(path, self.HOSTILE)}
		)

	def test_a_hostile_host_cannot_break_out_of_an_attribute(self):
		head = self.render("/weather")

		self.assertNotIn("<script>alert(1)</script>", head)
		self.assertIn("&lt;script&gt;", head)

	def test_a_hostile_host_cannot_end_the_json_ld_block(self):
		head = self.render("/")

		# One script element, and it is the JSON-LD one that belongs there.
		self.assertEqual(head.count("<script"), 1)
		self.assertIn('<script type="application/ld+json">', head)

	def test_the_rendered_json_ld_still_parses(self):
		head = self.render("/")
		block = head.split('<script type="application/ld+json">')[1].split("</script>")[0]

		documents = json.loads(block)
		self.assertEqual(documents[0]["url"], f"{self.HOSTILE}/")

	def test_an_ordinary_host_renders_one_title(self):
		head = frappe.render_template(
			HEAD_TEMPLATE.read_text(), {"seo": seo.page_metadata("/timer", BASE_URL)}
		)

		self.assertIn(f"<title>{seo.PAGES['/timer'].title}</title>", head)
		self.assertIn('<link rel="canonical" href="https://frappe.tools/timer" />', head)
