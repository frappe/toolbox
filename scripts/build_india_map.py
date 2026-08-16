#!/usr/bin/env python3
"""Build the compact India state-boundary GeoJSON the PIN map renders.

Source: geoBoundaries gbOpen IND ADM1 (CC BY 2.5 IN). The published "simplified" file is
still ~5 MB — far too big to bundle in the frontend — so this decimates each ring with
Ramer-Douglas-Peucker at a national-map tolerance and rounds coordinates, keeping only the
state name. The result is a few hundred KB: enough to place a PIN in its state, not a
survey-grade boundary.

Usage:
    curl -sL "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM1/geoBoundaries-IND-ADM1_simplified.geojson" -o india_adm1.geojson
    python build_india_map.py ./india_adm1.geojson ../frontend/src/tools/india-business-lookup/indiaStates.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TOLERANCE = 0.02  # degrees (~2 km); national-map fidelity
MIN_RING_POINTS = 5
PRECISION = 3


def build(source: Path, destination: Path) -> tuple[int, int]:
	data = json.loads(source.read_text(encoding="utf-8"))
	features = []
	for feature in data["features"]:
		rings = _simplify_geometry(feature["geometry"])
		if rings:
			features.append({
				"type": "Feature",
				"properties": {"name": feature["properties"].get("shapeName", "")},
				"geometry": {"type": "MultiPolygon", "coordinates": rings},
			})
	out = {"type": "FeatureCollection", "features": features}
	destination.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
	points = sum(len(r) for f in features for poly in f["geometry"]["coordinates"] for r in poly)
	return len(features), points


def _simplify_geometry(geometry: dict) -> list:
	polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
	simplified = []
	for polygon in polygons:
		# Keep the exterior ring only; interior holes do not matter at this scale.
		ring = _round(_rdp(polygon[0], TOLERANCE))
		if len(ring) >= MIN_RING_POINTS:
			simplified.append([ring])
	return simplified


def _rdp(points: list, epsilon: float) -> list:
	# Iterative Ramer-Douglas-Peucker (recursion would overflow on long coastlines).
	keep = [False] * len(points)
	keep[0] = keep[-1] = True
	stack = [(0, len(points) - 1)]
	while stack:
		start, end = stack.pop()
		furthest, distance = -1, 0.0
		for i in range(start + 1, end):
			d = _perpendicular_distance(points[i], points[start], points[end])
			if d > distance:
				furthest, distance = i, d
		if distance > epsilon and furthest != -1:
			keep[furthest] = True
			stack.append((start, furthest))
			stack.append((furthest, end))
	# `keep` is built as one flag per point, so `strict` states that rather than assuming it. A
	# silent `zip` would drop the tail of the longer list and quietly return a shorter coastline.
	return [point for point, kept in zip(points, keep, strict=True) if kept]


def _perpendicular_distance(point: list, start: list, end: list) -> float:
	(x, y), (x1, y1), (x2, y2) = point, start, end
	dx, dy = x2 - x1, y2 - y1
	if dx == 0 and dy == 0:
		return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
	t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
	t = max(0.0, min(1.0, t))
	px, py = x1 + t * dx, y1 + t * dy
	return ((x - px) ** 2 + (y - py) ** 2) ** 0.5


def _round(points: list) -> list:
	rounded = [[round(x, PRECISION), round(y, PRECISION)] for x, y in points]
	deduped = [rounded[0]]
	for point in rounded[1:]:
		if point != deduped[-1]:
			deduped.append(point)
	return deduped


def main(argv: list[str]) -> None:
	if len(argv) != 2:
		raise SystemExit(__doc__)
	source, destination = Path(argv[0]).resolve(strict=True), Path(argv[1])
	features, points = build(source, destination)
	size = destination.stat().st_size
	print(f"Wrote {features} states, {points:,} points, {size:,} bytes to {destination}")


if __name__ == "__main__":
	main(sys.argv[1:])
