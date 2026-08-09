#!/usr/bin/env python3
# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Draw the social card that Open Graph and Twitter show when somebody shares a Toolbox link.

The output is committed, because it is a static asset and a build should not need a font. Run
this again when the wordmark or the tagline changes:

    python scripts/build_og_card.py

The mark is the PWA icon, scaled down rather than redrawn, so the card cannot drift away from
the icon it is supposed to match.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP_ROOT = Path(__file__).resolve().parent.parent
ICON_PATH = APP_ROOT / "toolbox" / "public" / "pwa" / "toolbox-512.png"
OUTPUT_PATH = APP_ROOT / "toolbox" / "public" / "seo" / "toolbox-card.png"

# Open Graph reads 1200x630. Twitter's `summary_large_image` reads the same file.
WIDTH, HEIGHT = 1200, 630
MARGIN = 96
ICON_SIZE = 176

# Three bands down the card: the mark and wordmark, then what the site is, then where it lives.
# The baselines are stated rather than derived, because the gaps are a judgement about how the
# card reads at the size a timeline shows it, not a consequence of the type sizes.
TAGLINE_TOP = 352
FOOTER_NOTE_TOP = 416
RULE_TOP = 508
FOOTER_TOP = 532

# The app's own tokens: the surface a visitor sees, and the ink on it.
BACKGROUND = "#f8f8f8"
INK = "#171717"
MUTED = "#6b7280"
RULE = "#e2e2e2"

WORDMARK = "Toolbox"
TAGLINE = "Free online calculators, converters and lookups"
FOOTER = "frappe.tools"
FOOTER_NOTE = "No account. Nothing stored about you."

# Helvetica on macOS, DejaVu where a Linux box has no Helvetica. The file is committed, so this
# list only has to satisfy whoever regenerates the card.
FONT_CANDIDATES = (
	("/System/Library/Fonts/Helvetica.ttc", 1, 0),
	("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0, 0),
)


def load_fonts() -> tuple[ImageFont.FreeTypeFont, ...]:
	"""Return the bold and regular faces used on the card."""
	for path, bold_index, regular_index in FONT_CANDIDATES:
		if not Path(path).exists():
			continue
		return (
			ImageFont.truetype(path, 104, index=bold_index),
			ImageFont.truetype(path, 42, index=regular_index),
			ImageFont.truetype(path, 34, index=regular_index),
			ImageFont.truetype(path, 30, index=regular_index),
		)

	raise SystemExit(
		"No usable font was found. Add one to FONT_CANDIDATES and run this script again."
	)


def build_card() -> Image.Image:
	wordmark_font, tagline_font, note_font, footer_font = load_fonts()

	card = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
	draw = ImageDraw.Draw(card)

	icon = Image.open(ICON_PATH).convert("RGBA").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
	card.paste(icon, (MARGIN, MARGIN), icon)

	# The wordmark sits beside the mark, with their optical centres on one line.
	wordmark_top = MARGIN + (ICON_SIZE - text_height(draw, WORDMARK, wordmark_font)) // 2
	draw.text((MARGIN + ICON_SIZE + 44, wordmark_top), WORDMARK, font=wordmark_font, fill=INK)

	draw.text((MARGIN, TAGLINE_TOP), TAGLINE, font=tagline_font, fill=INK)
	draw.text((MARGIN, FOOTER_NOTE_TOP), FOOTER_NOTE, font=note_font, fill=MUTED)

	draw.line([(MARGIN, RULE_TOP), (WIDTH - MARGIN, RULE_TOP)], fill=RULE, width=2)
	draw.text((MARGIN, FOOTER_TOP), FOOTER, font=footer_font, fill=MUTED)

	return card


def text_height(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
	top, bottom = draw.textbbox((0, 0), text, font=font)[1::2]
	return bottom - top


def main() -> None:
	OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
	build_card().save(OUTPUT_PATH, "PNG", optimize=True)
	print(f"Wrote {OUTPUT_PATH.relative_to(APP_ROOT)} at {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
	main()
