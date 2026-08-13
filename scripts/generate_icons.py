#!/usr/bin/env python3
# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Draw the Toolbox mark: an open-end spanner, in the Frappe product-icon style.

Every icon the site serves is written from here. Run this after any change to the geometry, then
rebuild the social card, which embeds the 512px icon:

    python scripts/generate_icons.py
    python scripts/build_og_card.py

The mark is declared once and two renderers read it: one writes the SVG that the app sidebar and
Frappe use, the other rasterises the PNGs the web manifest lists. They were drawn by hand in two
places before, and had already drifted apart.

The numbers below were measured off the shipped Frappe product icons rather than guessed, so the
mark sits in the same family as Drive, Helpdesk and Insights: the same 235-unit box, the same
squircle corner, and a glyph of the same stroke weight filling the same share of the tile.

Two things are computed rather than typed, because both were got wrong by hand once:

  - the mark is centred by measuring where its ink actually lands. A knockout removes ink, so the
    visible centre is not the average of the shapes that draw it, and the first version of this
    mark sat six units to the left.
  - the maskable icon is shrunk only as far as it has to be to clear a launcher's crop.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

APP_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = APP_ROOT / "toolbox" / "public"

INK = "#171717"
PAPER = "#ffffff"

# Frappe's product icons are drawn in a 235-unit box with a 67.148-unit corner. That corner is
# not a quarter circle: its control point sits at 0.448 of the radius where a circle needs 0.552,
# and the flatter curve is what gives the family its continuous-corner squircle.
BOX = 235.0
TILE_RADIUS = 67.1481
TILE_CONTROL = 30.068

# The stroke their glyphs are drawn at, and the direction this one runs.
STROKE = 18.36
DIAGONAL = (math.sqrt(0.5), math.sqrt(0.5))
BACKWARD = (-DIAGONAL[0], -DIAGONAL[1])

# A launcher crops a maskable icon to whatever shape it likes, and only the middle 80% is
# guaranteed to survive. Anything reaching past that radius is scaled in until it clears.
MASKABLE_SAFE_RADIUS = BOX * 0.4

# Straight edges are drawn as polygons, so a diagonal is only ever as smooth as the raster it
# lands on. Drawing large and shrinking is what gives those edges their antialiasing.
SUPERSAMPLE = 6
MEASURE_RESOLUTION = 256


def generate_icons() -> None:
	write_svg(PUBLIC_DIR / "toolbox-logo.svg")
	write_png(PUBLIC_DIR / "pwa" / "toolbox-192.png", 192)
	write_png(PUBLIC_DIR / "pwa" / "toolbox-512.png", 512)
	write_png(PUBLIC_DIR / "pwa" / "toolbox-maskable-512.png", 512, maskable=True)


def mark(*, maskable: bool = False) -> list[tuple[str, list]]:
	"""The spanner, as colour and shapes in painter order, centred in the tile.

	The tile is not in this list. It is the background colour, plus the silhouette everything is
	clipped to, which is what keeps the jaw knockout from filling a corner it never reaches.
	"""
	operations = transformed(spanner(), centring_offset())
	if not maskable:
		return operations
	return transformed(operations, (0.0, 0.0), maskable_scale(operations))


def spanner() -> list[tuple[str, list]]:
	"""A disc with a parallel-sided slot cut into it, and a handle running down from it.

	The slot is the whole idea. A closed head with a handle is a magnifying glass at any size a
	sidebar or a browser tab shows, whatever detail is drawn inside it; a broken outer profile
	says spanner from the silhouette alone.
	"""
	centre, radius = (92.0, 92.0), 46.0
	jaw_width, jaw_depth = 46.0, 42.0

	head = [("circle", centre, radius)]
	handle = bar(along(centre, DIAGONAL, radius - STROKE), DIAGONAL, 78.0, STROKE)
	mouth = along(centre, BACKWARD, radius - jaw_depth)
	jaw = bar(mouth, BACKWARD, jaw_depth + STROKE, jaw_width)
	return [(PAPER, head + handle), (INK, jaw)]


def tile(*, maskable: bool = False) -> list[tuple[float, float]]:
	"""The silhouette of the icon, as a polygon.

	A launcher applies its own mask, so a maskable icon is a plain square and the squircle is
	only drawn for the icon that keeps its own corners.
	"""
	if maskable:
		return [(0.0, 0.0), (BOX, 0.0), (BOX, BOX), (0.0, BOX)]

	points = []
	for start, first, second, end in tile_corners():
		points.extend(flatten_cubic(start, first, second, end))
	return points


def tile_corners() -> list[tuple]:
	"""The four corner curves, walked clockwise from the top edge."""
	near, far = TILE_RADIUS, BOX - TILE_RADIUS
	control, opposite = TILE_CONTROL, BOX - TILE_CONTROL
	return [
		((far, 0.0), (opposite, 0.0), (BOX, control), (BOX, near)),
		((BOX, far), (BOX, opposite), (opposite, BOX), (far, BOX)),
		((near, BOX), (control, BOX), (0.0, opposite), (0.0, far)),
		((0.0, near), (0.0, control), (control, 0.0), (near, 0.0)),
	]


def centring_offset() -> tuple[float, float]:
	"""The shift that puts the mark's ink in the middle of the tile."""
	left, top, right, bottom = ink_box(spanner())
	return (BOX - right - left) / 2, (BOX - bottom - top) / 2


def maskable_scale(operations: list[tuple[str, list]]) -> float:
	"""How far the mark has to shrink to survive a launcher's crop, and no further."""
	left, top, right, bottom = ink_box(operations)
	centre = BOX / 2
	reach = max(math.dist((x, y), (centre, centre)) for x in (left, right) for y in (top, bottom))
	return min(1.0, MASKABLE_SAFE_RADIUS / reach)


def ink_box(operations: list[tuple[str, list]]) -> tuple[float, float, float, float]:
	"""Where the white of the mark actually lands, which is not where its shapes are.

	The jaw is painted in the tile colour, so it takes ink away, and no amount of reading the
	shapes will say where the result ends. Only a render knows.
	"""
	box = paint_mask(operations, MEASURE_RESOLUTION).getbbox()
	if box is None:
		raise ValueError("The mark drew no ink. Check the painter order in spanner().")
	unit = BOX / MEASURE_RESOLUTION
	return tuple(edge * unit for edge in box)


def write_svg(path: Path) -> None:
	elements = [f'<g fill="{INK}"><path d="{tile_path()}"/></g>']
	for colour, shapes in mark():
		body = "".join(svg_element(shape) for shape in shapes)
		elements.append(f'<g fill="{colour}">{body}</g>')

	# The id is scoped to this document: the file is only ever loaded through <img src>.
	clip = f'<clipPath id="tile"><path d="{tile_path()}"/></clipPath>'
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(
		f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {number(BOX)} {number(BOX)}"'
		f' role="img" aria-label="Toolbox"><defs>{clip}</defs>'
		f'<g clip-path="url(#tile)">{"".join(elements)}</g></svg>\n'
	)
	print(f"Wrote {path.relative_to(APP_ROOT)}")


def write_png(path: Path, size: int, *, maskable: bool = False) -> None:
	icon = paint(mark(maskable=maskable), size * SUPERSAMPLE, maskable=maskable)
	path.parent.mkdir(parents=True, exist_ok=True)
	icon.resize((size, size), Image.LANCZOS).save(path, format="PNG", optimize=True)
	print(f"Wrote {path.relative_to(APP_ROOT)} at {size}x{size}")


def paint(operations, extent: int, *, maskable: bool) -> Image.Image:
	"""The finished icon: the mark in its colours, clipped to the tile."""
	scale = extent / BOX
	canvas = Image.new("RGB", (extent, extent), INK)
	draw = ImageDraw.Draw(canvas)
	for colour, shapes in operations:
		for shape in shapes:
			draw_shape(draw, shape, colour, scale)

	silhouette = Image.new("L", (extent, extent), 0)
	ImageDraw.Draw(silhouette).polygon([(x * scale, y * scale) for x, y in tile(maskable=maskable)], fill=255)
	canvas.putalpha(silhouette)
	return canvas


def paint_mask(operations, extent: int) -> Image.Image:
	"""The mark as white on black. The tile is left out: this is only ever measured, not saved."""
	scale = extent / BOX
	canvas = Image.new("L", (extent, extent), 0)
	draw = ImageDraw.Draw(canvas)
	for colour, shapes in operations:
		for shape in shapes:
			draw_shape(draw, shape, 255 if colour == PAPER else 0, scale)
	return canvas


def transformed(operations, offset, scale: float = 1.0) -> list[tuple[str, list]]:
	"""Move the mark, then scale it about the centre of the tile."""
	centre = BOX / 2

	def move(point):
		return (
			centre + (point[0] + offset[0] - centre) * scale,
			centre + (point[1] + offset[1] - centre) * scale,
		)

	moved = []
	for colour, shapes in operations:
		shifted = []
		for shape in shapes:
			if shape[0] == "circle":
				shifted.append(("circle", move(shape[1]), shape[2] * scale))
			else:
				shifted.append(("polygon", [move(point) for point in shape[1]]))
		moved.append((colour, shifted))
	return moved


def bar(start, direction, length: float, width: float) -> list:
	"""A rectangle of `width` laid along `direction`."""
	across = (-direction[1], direction[0])
	half = width / 2
	end = along(start, direction, length)
	return [
		(
			"polygon",
			[
				(start[0] + across[0] * half, start[1] + across[1] * half),
				(end[0] + across[0] * half, end[1] + across[1] * half),
				(end[0] - across[0] * half, end[1] - across[1] * half),
				(start[0] - across[0] * half, start[1] - across[1] * half),
			],
		)
	]


def svg_element(shape: tuple) -> str:
	if shape[0] == "circle":
		return f'<circle cx="{number(shape[1][0])}" cy="{number(shape[1][1])}" r="{number(shape[2])}"/>'
	points = " ".join(f"{number(x)},{number(y)}" for x, y in shape[1])
	return f'<polygon points="{points}"/>'


def tile_path() -> str:
	"""The squircle as an SVG path, from the same curves the polygon is flattened from.

	Each corner is moved to before it is drawn. Chaining the four curves straight into one
	another instead drops the flat edge between them, and the tile comes out a blob.
	"""
	segments = []
	for start, first, second, end in tile_corners():
		segments.append(f"{'L' if segments else 'M'}{number(start[0])} {number(start[1])}")
		segments.append(
			f"C{number(first[0])} {number(first[1])} {number(second[0])} {number(second[1])}"
			f" {number(end[0])} {number(end[1])}"
		)
	return " ".join(segments) + "Z"


def draw_shape(draw: ImageDraw.ImageDraw, shape: tuple, colour: str | int, scale: float) -> None:
	if shape[0] == "circle":
		(x, y), radius = shape[1], shape[2] * scale
		draw.ellipse(
			(x * scale - radius, y * scale - radius, x * scale + radius, y * scale + radius), fill=colour
		)
	else:
		draw.polygon([(x * scale, y * scale) for x, y in shape[1]], fill=colour)


def flatten_cubic(start, first, second, end, samples: int = 48) -> list[tuple[float, float]]:
	points = []
	for step in range(samples + 1):
		t = step / samples
		points.append(
			tuple(
				(1 - t) ** 3 * start[axis]
				+ 3 * (1 - t) ** 2 * t * first[axis]
				+ 3 * (1 - t) * t**2 * second[axis]
				+ t**3 * end[axis]
				for axis in (0, 1)
			)
		)
	return points


def along(origin, direction, distance: float) -> tuple[float, float]:
	return origin[0] + direction[0] * distance, origin[1] + direction[1] * distance


def number(value: float) -> str:
	return f"{round(value, 3):g}"


if __name__ == "__main__":
	generate_icons()
