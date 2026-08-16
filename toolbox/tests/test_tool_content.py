# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import json
from pathlib import Path

from frappe.tests import UnitTestCase

from toolbox import tool_content
from toolbox.routes import TOOL_ROUTES

# A page written by hand rather than generated, so a change to the pipeline that empties every
# file still fails here.
WRITTEN_PAGE = "/emi-calculator"


class TestPageFiles(UnitTestCase):
	"""The build writes one file for each tool, and the server reads it on every request."""

	def test_every_tool_route_has_a_page(self):
		"""A route with no file answers a crawler with an empty body, and nothing else fails."""
		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				self.assertIsNotNone(tool_content.page_content(f"/{route}"))

	def test_every_tool_page_is_written(self):
		"""A tool with no text answers a search with a heading and nothing else.

		This fails for a tool added without its page in `toolbox/content`, which is the point:
		a page nobody can read from a search result is the failure this whole change removes.
		"""
		for route in TOOL_ROUTES:
			with self.subTest(route=route):
				content = tool_content.page_content(f"/{route}")
				self.assertIn("Frequently asked questions", content.content)
				self.assertGreaterEqual(len(content.faqs), 4)
				self.assertTrue(content.steps)

	def test_a_route_without_a_file_has_no_content(self):
		self.assertIsNone(tool_content.page_content("/settings"))
		self.assertIsNone(tool_content.page_content("/"))

	def test_a_requested_path_cannot_read_outside_the_content_directory(self):
		"""The route comes from the request, so it is untrusted input that names a file."""
		for route in ("/../../../hooks", "/..", "//etc/passwd", "/pages/../../hooks"):
			with self.subTest(route=route):
				self.assertIsNone(tool_content.page_content(route))

	def test_a_rebuilt_file_reaches_the_next_request(self):
		"""The file is cached, so the modification time has to be part of the key."""
		path = tool_content.PAGES_DIRECTORY / "emi-calculator.json"
		original = path.read_text(encoding="utf-8")
		page = json.loads(original)
		page["content"] = "<p>rebuilt</p>"

		try:
			path.write_text(json.dumps(page), encoding="utf-8")
			self.assertEqual(tool_content.page_content(WRITTEN_PAGE).content, "<p>rebuilt</p>")
		finally:
			path.write_text(original, encoding="utf-8")

		self.assertNotIn("rebuilt", tool_content.page_content(WRITTEN_PAGE).content)


class TestWrittenContent(UnitTestCase):
	"""What a page that has been written carries."""

	def setUp(self):
		self.content = tool_content.page_content(WRITTEN_PAGE)

	def test_the_content_continues_the_heading_hierarchy(self):
		"""The heading block owns the h1, so the content starts at the second level."""
		self.assertIn("</h2>", self.content.content)
		self.assertNotIn("<h1", self.content.content)

	def test_the_questions_are_plain_text(self):
		"""JSON-LD carries a question and an answer as strings. Markup there is read as text."""
		for faq in self.content.faqs:
			with self.subTest(question=faq.question):
				self.assertTrue(faq.question.endswith("?"))
				self.assertNotIn("<", faq.answer)
				self.assertNotIn("**", faq.answer)

	def test_the_steps_are_plain_text(self):
		self.assertTrue(self.content.steps)
		for step in self.content.steps:
			self.assertNotIn("<", step)


class TestPageWidth(UnitTestCase):
	"""The server block has to be the width the application draws.

	They disagreed until #274: the heading sat in a 768px column and the page it preceded ran to
	1152px, so the text moved sideways the moment Vue replaced the block. Nothing failed — a
	crawler cannot see a layout shift, and no browser test measured one.
	"""

	def test_a_tool_route_takes_the_one_page_width(self):
		for route in ("/calculator", "/length-converter", "/time-zone-converter", "/"):
			with self.subTest(route=route):
				self.assertEqual(tool_content.page_width(route), tool_content.TOOL_PAGE_WIDTH)

	def test_a_prose_route_keeps_a_reading_measure(self):
		for route in ("/about", "/data-sources"):
			with self.subTest(route=route):
				self.assertEqual(tool_content.page_width(route), tool_content.PROSE_PAGE_WIDTH)

	def test_the_widths_match_the_frontend_source(self):
		"""`pageLayout.js` is the source. This side is a mirror, so it is read rather than trusted."""
		source = (
			Path(tool_content.__file__).parent.parent / "frontend" / "src" / "data" / "pageLayout.js"
		).read_text()

		for name, value in (
			("TOOL_PAGE_WIDTH", tool_content.TOOL_PAGE_WIDTH),
			("PROSE_PAGE_WIDTH", tool_content.PROSE_PAGE_WIDTH),
		):
			with self.subTest(constant=name):
				self.assertIn(f"export const {name} = '{value}'", source)

		for route in tool_content.PROSE_ROUTES:
			with self.subTest(route=route):
				self.assertIn(f"'{route}'", source)
