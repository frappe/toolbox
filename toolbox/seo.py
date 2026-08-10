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
	"/emi-calculator": Page(
		name="EMI Calculator",
		title="EMI Calculator — Loan Instalment and Schedule",
		description=(
			"Work out the monthly instalment on a loan, and read the full amortisation "
			"schedule showing how much of each payment is interest. Free."
		),
		application_category="FinanceApplication",
	),
	"/compound-interest-calculator": Page(
		name="Compound Interest Calculator",
		title="Compound Interest Calculator With Contributions",
		description=(
			"See what a sum grows to at a given rate, with or without a regular contribution, "
			"and at the compounding frequency you choose. Free."
		),
		application_category="FinanceApplication",
	),
	"/sip-calculator": Page(
		name="SIP Calculator",
		title="SIP Calculator — Monthly Investment Returns",
		description=(
			"Project what a monthly systematic investment adds up to over time, and how much "
			"of the total is growth rather than what you put in. Free."
		),
		application_category="FinanceApplication",
	),
	"/cagr-calculator": Page(
		name="CAGR Calculator",
		title="CAGR Calculator — Compound Annual Growth Rate",
		description=(
			"Find the compound annual growth rate between a starting value and an ending "
			"value over any number of years. Free."
		),
		application_category="FinanceApplication",
	),
	"/future-value-calculator": Page(
		name="Future Value Calculator",
		title="Future Value Calculator — What an Amount Becomes",
		description=(
			"Project what an amount is worth after a number of years at a rate you set. Free, "
			"and the assumptions are stated rather than hidden."
		),
		application_category="FinanceApplication",
	),
	"/break-even-calculator": Page(
		name="Break-Even Calculator",
		title="Break-Even Calculator — Units to Cover Costs",
		description=(
			"Find how many units you need to sell before revenue covers fixed and variable "
			"costs, with the crossover shown on a chart. Free."
		),
		application_category="FinanceApplication",
	),
	"/bmi-calculator": Page(
		name="BMI Calculator",
		title="BMI Calculator — Work Out Your Body Mass Index",
		description=(
			"Work out your body mass index from your height and weight, and see the category it "
			"falls in. Free, in metric or imperial units."
		),
		application_category="HealthApplication",
	),
	"/bmr-calculator": Page(
		name="BMR Calculator",
		title="BMR Calculator — Basal Metabolic Rate",
		description=(
			"Estimate the energy your body uses at rest, using the Mifflin-St Jeor equation. "
			"Free, in metric or imperial units."
		),
		application_category="HealthApplication",
	),
	"/tdee-calculator": Page(
		name="TDEE Calculator",
		title="TDEE Calculator — Daily Calories You Burn",
		description=(
			"Estimate the calories you burn in a day from your BMR and an activity level you "
			"choose. Free, and the activity factor is stated rather than hidden."
		),
		application_category="HealthApplication",
	),
	"/pace-calculator": Page(
		name="Pace Calculator",
		title="Running Pace Calculator — Distance, Time and Pace",
		description=(
			"Enter any two of distance, duration and pace, and get the third. Free, in "
			"kilometres or miles, for a 5K through to a marathon."
		),
		application_category="HealthApplication",
	),
	"/length-converter": Page(
		name="Length Converter",
		title="Length Converter — Metres, Feet, Miles and Inches",
		description=(
			"Convert between metres, feet, inches, miles and more, with exact factors. Free, and it "
			"works without an internet connection."
		),
		application_category="UtilitiesApplication",
	),
	"/area-converter": Page(
		name="Area Converter",
		title="Area Converter — Square Metres, Acres and Hectares",
		description=(
			"Convert between square metres, square feet, acres and hectares. Free, exact, and it "
			"works without an internet connection."
		),
		application_category="UtilitiesApplication",
	),
	"/volume-converter": Page(
		name="Volume Converter",
		title="Volume Converter — Litres, Gallons and Cups",
		description=(
			"Convert between litres, millilitres, gallons, cups and cubic metres. Free, and it tells "
			"you which gallon it means."
		),
		application_category="UtilitiesApplication",
	),
	"/weight-converter": Page(
		name="Weight Converter",
		title="Weight Converter — Kilograms, Pounds and Stones",
		description=(
			"Convert between kilograms, pounds, stones, ounces and tonnes. Free, exact, and it works "
			"without an internet connection."
		),
		application_category="UtilitiesApplication",
	),
	"/temperature-converter": Page(
		name="Temperature Converter",
		title="Temperature Converter — Celsius, Fahrenheit, Kelvin",
		description=(
			"Convert between Celsius, Fahrenheit and Kelvin. Free, and the conversion runs on your "
			"own device."
		),
		application_category="UtilitiesApplication",
	),
	"/speed-converter": Page(
		name="Speed Converter",
		title="Speed Converter — km/h, mph, Knots and m/s",
		description=(
			"Convert between kilometres per hour, miles per hour, knots and metres per second. Free "
			"and exact."
		),
		application_category="UtilitiesApplication",
	),
	"/time-unit-converter": Page(
		name="Time Unit Converter",
		title="Time Unit Converter — Seconds, Hours and Days",
		description=(
			"Convert between seconds, minutes, hours, days and weeks. For converting a time between "
			"zones, use the World Clock."
		),
		application_category="UtilitiesApplication",
	),
	"/data-storage-converter": Page(
		name="Data Storage Converter",
		title="Data Storage Converter — MB, GB and TB",
		description=(
			"Convert between bytes, kilobytes, megabytes, gigabytes and terabytes. Free, and the "
			"units are stated unambiguously."
		),
		application_category="UtilitiesApplication",
	),
	"/fuel-consumption-converter": Page(
		name="Fuel Consumption Converter",
		title="Fuel Consumption Converter — MPG and L/100km",
		description=(
			"Convert between miles per gallon, litres per 100 kilometres and kilometres per litre. "
			"Free and exact."
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
	"/pin-code-search": Page(
		name="PIN Code Search",
		title="PIN Code Search — Find Any Indian Postal Code",
		description=(
			"Find an Indian PIN code by area, post office, district or state, and see the "
			"offices it covers. Free, and answered from a local dataset."
		),
		application_category="BusinessApplication",
	),
	"/ifsc-code-search": Page(
		name="IFSC Code Search",
		title="IFSC Code Search — Find Any Bank Branch Code",
		description=(
			"Look up a bank IFSC code by code, bank, branch or city, with the branch address "
			"and MICR. Free, and answered from a local dataset."
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
		name="Timer",
		title="Online Timer — Count Down From Any Number of Minutes",
		description=(
			"A free online timer that counts down from the minutes you set, with an optional "
			"label. It keeps accurate time across a pause and a refresh."
		),
		application_category="UtilitiesApplication",
	),
	"/stopwatch": Page(
		name="Stopwatch",
		title="Online Stopwatch With Laps",
		description=(
			"A free online stopwatch. Start it, record a lap without stopping the clock, and "
			"read each split beside the total elapsed time."
		),
		application_category="UtilitiesApplication",
	),
	"/countdown-timer": Page(
		name="Countdown Timer",
		title="Countdown Timer — Count Down to Any Date",
		description=(
			"Count down to a date and time, or for a duration you set. Free, and it keeps the "
			"right time across a refresh or a change of date."
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
