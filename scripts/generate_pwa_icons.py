from pathlib import Path

from PIL import Image, ImageDraw


APP_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = APP_ROOT / "toolbox" / "public" / "pwa"
INK = "#171717"
PAPER = "#ffffff"


def generate_icons() -> None:
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
	draw_icon(192, OUTPUT_DIR / "toolbox-192.png")
	draw_icon(512, OUTPUT_DIR / "toolbox-512.png")
	draw_icon(512, OUTPUT_DIR / "toolbox-maskable-512.png", maskable=True)


def draw_icon(size: int, output_path: Path, *, maskable: bool = False) -> None:
	image = Image.new("RGB", (size, size), INK)
	draw = ImageDraw.Draw(image)

	if not maskable:
		corner_radius = round(size * 0.22)
		image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
		draw = ImageDraw.Draw(image)
		draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=corner_radius, fill=INK)

	left, top, right, bottom = scale_box(size, (0.28, 0.37, 0.72, 0.72))
	draw.rectangle((left, top, right, bottom), fill=PAPER)

	handle_left, handle_top, handle_right, handle_bottom = scale_box(size, (0.39, 0.27, 0.61, 0.40))
	stroke = max(4, round(size * 0.055))
	draw.rectangle(
		(handle_left, handle_top, handle_right, handle_bottom),
		fill=INK,
		outline=PAPER,
		width=stroke,
	)

	divider_y = round(size * 0.48)
	draw.line((left, divider_y, right, divider_y), fill=INK, width=max(3, round(size * 0.045)))

	latch_left, latch_top, latch_right, latch_bottom = scale_box(size, (0.455, 0.45, 0.545, 0.55))
	draw.rectangle(
		(latch_left, latch_top, latch_right, latch_bottom),
		fill=PAPER,
		outline=INK,
		width=max(2, round(size * 0.03)),
	)

	image.save(output_path, format="PNG", optimize=True)


def scale_box(size: int, bounds: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
	return tuple(round(size * value) for value in bounds)


if __name__ == "__main__":
	generate_icons()
