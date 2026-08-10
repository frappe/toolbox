# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""The page metadata a search engine reads, one entry for each route Toolbox serves.

Toolbox is a client-rendered application. A crawler runs no JavaScript before it decides what a
page is about, so everything here is rendered into the server response by `toolbox/www/toolbox.py`
rather than set by the client after boot.

This module imports nothing from Frappe. The copy is the product, it is worth testing on its own,
and a plain function that takes a base URL is easier to test than one that reads a request. The
same reasoning put the city folding rule in `toolbox/city_names.py`.

`toolbox/tests/test_seo.py` fails when this module and `toolbox/routes.py` disagree about which
routes exist. That is the tripwire `frontend/src/data/appRoutes.test.js` already applies to the
route list itself: a tool added in one place and forgotten in another is invisible to every other
test.
"""

import json
from dataclasses import dataclass

from toolbox.routes import APP_ROUTES, TOOL_ROUTES

SITE_NAME = "Toolbox"
PUBLISHER_NAME = "Frappe Technologies"
PUBLISHER_URL = "https://frappe.io"

# The image a social network shows when somebody shares a link. One image serves every route:
# a per-tool image is a content decision, and content comes after the tabbed tools are split.
CARD_IMAGE = "/assets/toolbox/seo/toolbox-card.png"
CARD_IMAGE_WIDTH = "1200"
CARD_IMAGE_HEIGHT = "630"

ROOT_PATH = "/"


@dataclass(frozen=True)
class Page:
	"""What a search engine and a social preview are told about one route."""

	# The short name, used in a breadcrumb and in the list of tools at the root. The registry
	# holds the name the interface shows; this is the name a search result shows.
	name: str
	title: str
	description: str
	# A schema.org `applicationCategory`. A page that is not a tool leaves it unset.
	application_category: str | None = None
	indexable: bool = True


# Ordered as the page is read: the root first, then the tools, then the pages that support them.
PAGES: dict[str, Page] = {
	ROOT_PATH: Page(
		name="All Tools",
		title="Toolbox — Free Online Calculators and Converters",
		description=(
			"A free set of everyday tools: calculators, converters, lookups and reference data. "
			"No account, no sign-up, and nothing stored about you."
		),
	),
	"/calculator": Page(
		name="Calculator",
		title="Online Calculator — Everyday and Scientific Math",
		description=(
			"A free online calculator for everyday arithmetic and scientific expressions, "
			"with a history of your recent results. Works without an internet connection."
		),
		application_category="UtilitiesApplication",
	),
	"/gst-calculator": Page(
		name="GST Calculator",
		title="GST Calculator — Add or Remove GST, CGST, SGST, IGST",
		description=(
			"Add or remove Indian GST at any rate, and split the tax into CGST and SGST, or "
			"into IGST. Free, instant, and calculated on your own device."
		),
		application_category="FinanceApplication",
	),
	"/financial-calculators": Page(
		name="Financial Calculators",
		title="EMI, SIP, CAGR and Compound Interest Calculators",
		description=(
			"Work out a loan EMI, compound interest, SIP returns, CAGR and a break-even point. "
			"Free financial calculators with charts and a full repayment schedule."
		),
		application_category="FinanceApplication",
	),
	"/health-calculators": Page(
		name="Health & Fitness Calculators",
		title="BMI, BMR and Daily Calorie Calculator",
		description=(
			"Calculate your BMI, BMR, daily maintenance calories and running pace. Free health "
			"calculators that take metric or imperial units."
		),
		application_category="HealthApplication",
	),
	"/unit-converter": Page(
		name="Unit Converter",
		title="Unit Converter — Length, Weight, Temperature, Speed",
		description=(
			"Convert length, weight, temperature, area, volume, speed and data size. Exact "
			"conversion factors, no external service, and it works offline."
		),
		application_category="UtilitiesApplication",
	),
	"/currency-converter": Page(
		name="Currency Converter",
		title="Currency Converter — European Central Bank Rates",
		description=(
			"Convert between world currencies using dated European Central Bank reference "
			"rates, and read the rate history on a chart."
		),
		application_category="FinanceApplication",
	),
	"/hsn-sac-lookup": Page(
		name="HSN & SAC Lookup",
		title="HSN and SAC Code Finder for Indian GST",
		description=(
			"Search Indian HSN codes for goods and SAC codes for services, by code or by "
			"description. A free GST classification lookup over the published catalogue."
		),
		application_category="BusinessApplication",
	),
	"/india-business-lookup": Page(
		name="India Business Lookup",
		title="PIN Code and Bank IFSC Code Search for India",
		description=(
			"Find an Indian PIN code by area or post office, and look up any bank IFSC code "
			"with its branch address. Free, and answered from a local dataset."
		),
		application_category="BusinessApplication",
	),
	"/world-clock": Page(
		name="World Clock",
		title="World Clock and Time Zone Converter",
		description=(
			"Compare the time in cities worldwide, convert a time between zones, and find the "
			"working hours that two places share."
		),
		application_category="UtilitiesApplication",
	),
	"/timer": Page(
		name="Timer, Stopwatch & Countdown",
		title="Online Timer, Stopwatch and Countdown",
		description=(
			"A free online timer, a stopwatch with laps, and a countdown to any date. Keeps "
			"accurate time across a pause, a refresh and a change of date."
		),
		application_category="UtilitiesApplication",
	),
	"/weather": Page(
		name="Weather",
		title="Weather Forecast by City — Ten Day Outlook",
		description=(
			"Current conditions and a ten-day forecast for any city, from MET Norway. Search "
			"for a city by the name it is known by locally: München, Roma, Bombay."
		),
		application_category="UtilitiesApplication",
	),
	"/dictionary": Page(
		name="Dictionary",
		title="English Dictionary — Word Meanings and Definitions",
		description=(
			"Look up what an English word means, with its part of speech and example use, from "
			"the openly licensed WordNet dataset."
		),
		application_category="ReferenceApplication",
	),
	"/script-conversion": Page(
		name="Script Conversion",
		title="Transliterate Indic Scripts — Devanagari, Tamil, IAST",
		description=(
			"Transliterate text between Indic scripts and Roman schemes such as IAST and "
			"ITRANS. It runs on your device, so your text is never sent anywhere."
		),
		application_category="ReferenceApplication",
	),
	"/audio-recorder": Page(
		name="Audio Recorder",
		title="Online Voice Recorder — Record Audio in a Browser",
		description=(
			"Record a voice note with your microphone and save it to your own device. Nothing "
			"is uploaded, because there is nowhere to upload it to."
		),
		application_category="MultimediaApplication",
	),
	"/audio-editor": Page(
		name="Audio Editor",
		title="Online Audio Editor — Trim, Fade and Export WAV",
		description=(
			"Trim an audio clip, add a fade, adjust the gain, and export a WAV file. Every "
			"edit happens in your browser."
		),
		application_category="MultimediaApplication",
	),
	"/settings": Page(
		name="Settings",
		title="Settings",
		description="Choose the theme, units and number format Toolbox uses in this browser session.",
		# Nobody searches for a settings page, and it holds no content to rank.
		indexable=False,
	),
}


def page_metadata(path: str, base_url: str) -> dict[str, str]:
	"""Return the head of the page Frappe serves for `path`.

	`base_url` is the site's own origin. It comes from the request rather than a constant, so a
	preview deployment declares itself canonical instead of pointing at production.
	"""
	route = normalise_path(path)
	page = PAGES.get(route)
	if page is None:
		# Frappe only routes the paths in `routes.py` to this template, and a test holds those
		# to the same set as `PAGES`. Falling back to the root keeps a coherent head anyway,
		# because a head that is wrong beats a head that is missing.
		route, page = ROOT_PATH, PAGES[ROOT_PATH]

	return {
		"title": page.title,
		"description": page.description,
		"canonical": absolute_url(base_url, route),
		"robots": "index, follow" if page.indexable else "noindex, follow",
		"site_name": SITE_NAME,
		"image": absolute_url(base_url, CARD_IMAGE),
		"image_width": CARD_IMAGE_WIDTH,
		"image_height": CARD_IMAGE_HEIGHT,
		"structured_data": as_json_ld(structured_data(route, page, base_url)),
	}


def route_titles() -> dict[str, str]:
	"""Return the title of every route, for the client to reuse after an in-app navigation.

	The client repeats the server's own text rather than composing a second version of it. Two
	titles for one page is a contradiction a crawler can see, because it reads the served HTML
	and then renders the page.
	"""
	return {route: page.title for route, page in PAGES.items()}


def normalise_path(path: str) -> str:
	"""Turn a requested path into the key `PAGES` uses.

	Frappe hands this module a path with no leading slash for a route rule, and the empty string
	for the root. A trailing slash is the visitor's, and names the same page.
	"""
	return "/" + (path or "").strip().strip("/")


def absolute_url(base_url: str, path: str) -> str:
	"""Join the site origin to a path. A canonical URL and an image URL both have to be absolute."""
	return base_url.rstrip("/") + path


def structured_data(route: str, page: Page, base_url: str) -> list[dict]:
	"""Return the JSON-LD for one route.

	The root describes the site and lists the tools. A tool describes itself and its place in the
	site. A page that is not indexed describes nothing, because structured data for a page a
	crawler is asked to skip is only a contradiction.
	"""
	if route == ROOT_PATH:
		return [website_schema(base_url), tool_list_schema(base_url)]
	if not page.indexable:
		return []
	return [web_application_schema(route, page, base_url), breadcrumb_schema(route, page, base_url)]


def website_schema(base_url: str) -> dict:
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": SITE_NAME,
		"url": absolute_url(base_url, ROOT_PATH),
		"description": PAGES[ROOT_PATH].description,
		"publisher": publisher_schema(),
	}


def tool_list_schema(base_url: str) -> dict:
	"""List the tools, in the order `routes.py` names them, so a search result can link into one."""
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		"name": "Toolbox tools",
		"numberOfItems": len(TOOL_ROUTES),
		"itemListElement": [
			{
				"@type": "ListItem",
				"position": position,
				"name": PAGES[f"/{route}"].name,
				"url": absolute_url(base_url, f"/{route}"),
			}
			for position, route in enumerate(TOOL_ROUTES, start=1)
		],
	}


def web_application_schema(route: str, page: Page, base_url: str) -> dict:
	"""Describe a tool as a free web application.

	The price is stated rather than implied. `Offer` with a zero price is how schema.org says
	"this costs nothing", and it is what puts the word free in a search result.
	"""
	return {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": page.name,
		"url": absolute_url(base_url, route),
		"description": page.description,
		"applicationCategory": page.application_category,
		"operatingSystem": "Any",
		"browserRequirements": "Requires JavaScript",
		"offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
		"isPartOf": {
			"@type": "WebSite",
			"name": SITE_NAME,
			"url": absolute_url(base_url, ROOT_PATH),
		},
		"publisher": publisher_schema(),
	}


def breadcrumb_schema(route: str, page: Page, base_url: str) -> dict:
	"""Two levels, because two levels is what the navigation has.

	A category level goes here when the navigation grows one.
	"""
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		"itemListElement": [
			{
				"@type": "ListItem",
				"position": 1,
				"name": SITE_NAME,
				"item": absolute_url(base_url, ROOT_PATH),
			},
			{
				"@type": "ListItem",
				"position": 2,
				"name": page.name,
				"item": absolute_url(base_url, route),
			},
		],
	}


def publisher_schema() -> dict:
	return {"@type": "Organization", "name": PUBLISHER_NAME, "url": PUBLISHER_URL}


def served_routes() -> set[str]:
	"""Return every route Frappe sends to this template. `PAGES` has to cover exactly these."""
	return {ROOT_PATH} | {f"/{route}" for route in APP_ROUTES}


def indexable_routes() -> list[str]:
	"""Return the routes a sitemap should offer, in the order a reader would meet them.

	This is the same `indexable` flag that decides the robots meta tag, so a page cannot be told
	to stay out of the index and then be advertised for crawling in the same breath.
	"""
	return [route for route, page in PAGES.items() if page.indexable]


def as_json_ld(documents: list[dict]) -> str:
	"""Serialise structured data for a `<script type="application/ld+json">` block.

	The copy here is ours, so it carries no closing tag today. Escaping `<` anyway means a
	description written later cannot end the script element early and turn text into markup.
	"""
	if not documents:
		return ""
	payload = documents[0] if len(documents) == 1 else documents
	return json.dumps(payload, separators=(",", ":")).replace("<", "\\u003c")
