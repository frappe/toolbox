# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

import importlib.util
import math
import sys
from pathlib import Path

import frappe
from frappe.tests import UnitTestCase
from PIL import Image

APP_ROOT = Path(frappe.get_app_path("toolbox")).parent
PUBLIC = APP_ROOT / "toolbox" / "public"


def load_generator():
	"""Import `scripts/generate_icons.py`, which sits outside the importable package."""
	path = APP_ROOT / "scripts" / "generate_icons.py"
	specification = importlib.util.spec_from_file_location("toolbox_generate_icons", path)
	module = importlib.util.module_from_spec(specification)
	sys.modules[specification.name] = module
	specification.loader.exec_module(module)
	return module


class TestIconGeometry(UnitTestCase):
	"""The mark is centred by measurement rather than by hand, because it was got wrong by hand:
	the first version sat six units left of centre, which is visible at any size."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.icons = load_generator()

	def test_the_mark_sits_in_the_middle_of_the_tile(self):
		left, top, right, bottom = self.icons.ink_box(self.icons.mark())
		box = self.icons.BOX
		# A quarter of a unit in 235 is a twentieth of a pixel on the 192px icon.
		self.assertAlmostEqual(left, box - right, delta=0.25, msg="the mark is off-centre sideways")
		self.assertAlmostEqual(top, box - bottom, delta=0.25, msg="the mark is off-centre vertically")

	def test_the_mark_fills_the_share_of_the_tile_the_frappe_icons_do(self):
		left, _, right, _ = self.icons.ink_box(self.icons.mark())
		self.assertAlmostEqual((right - left) / self.icons.BOX, 0.57, delta=0.07)

	def test_the_maskable_icon_survives_a_launcher_crop(self):
		"""Only the middle 80% of a maskable icon is guaranteed; the rest is the launcher's."""
		left, top, right, bottom = self.icons.ink_box(self.icons.mark(maskable=True))
		centre = self.icons.BOX / 2
		reach = max(math.dist((x, y), (centre, centre)) for x in (left, right) for y in (top, bottom))
		self.assertLessEqual(reach, self.icons.MASKABLE_SAFE_RADIUS)


class TestCommittedIcons(UnitTestCase):
	"""The icons are generated and committed, so a fresh clone and a deployment both serve the
	real mark without running a build. That only holds while the files match the generator."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.icons = load_generator()

	def test_the_committed_svg_carries_the_generated_tile(self):
		"""The tile is Frappe's own squircle. Chaining its four corner curves without the flat
		edge between them yields a blob, and nothing but a rendered comparison notices."""
		svg = (PUBLIC / "toolbox-logo.svg").read_text()
		self.assertIn(self.icons.tile_path(), svg)
		self.assertIn(f'viewBox="0 0 {self.icons.number(self.icons.BOX)}', svg)

	def test_the_committed_svg_clips_everything_to_the_tile(self):
		"""The jaw is painted in the tile colour. Unclipped, it fills the corner it reaches."""
		svg = (PUBLIC / "toolbox-logo.svg").read_text()
		self.assertIn('clip-path="url(#tile)"', svg)

	def test_every_icon_the_manifest_lists_is_committed_at_its_stated_size(self):
		for name, size in (("toolbox-192", 192), ("toolbox-512", 512), ("toolbox-maskable-512", 512)):
			with self.subTest(icon=name):
				with Image.open(PUBLIC / "pwa" / f"{name}.png") as icon:
					self.assertEqual(icon.size, (size, size))
					self.assertEqual(icon.mode, "RGBA")

	def test_only_the_maskable_icon_fills_its_corners(self):
		"""A launcher masks the maskable one itself, so it is square. The others keep the
		squircle, and a corner that is not transparent shows as a black box behind it."""
		for name, opaque in (("toolbox-192", False), ("toolbox-512", False), ("toolbox-maskable-512", True)):
			with self.subTest(icon=name):
				with Image.open(PUBLIC / "pwa" / f"{name}.png") as icon:
					self.assertEqual(icon.getpixel((0, 0))[3] == 255, opaque)
