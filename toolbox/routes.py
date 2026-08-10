# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""The app routes Toolbox serves at the site root.

Toolbox owns the whole site, so its tools sit directly under `/`: `/calculator`, not
`/toolbox/calculator`.

This list is explicit on purpose. `resolve_from_map` rewrites a path before any renderer is
chosen (`frappe/website/path_resolver.py`), so a catch-all rule at the root would swallow
`/login`, `/app` and every other website page. Naming each route keeps Frappe's own pages
reachable.

`frontend/src/data/toolRegistry.test.js` fails when this list and the frontend registry disagree,
so adding a tool to one without the other cannot ship.

The root itself is not here. `resolve_path` maps an empty path to `index` and calls
`get_home_page()` without consulting the route map, so `/` is handled by the `website_user_home_page`
hook instead.
"""

WEB_PAGE = "toolbox"

# Pages that are not tools. `all-tools` is absent on purpose: the root *is* the All Tools page,
# so `/all-tools` redirects to `/` rather than serving a second copy of it.
APP_PAGES = ("settings",)

TOOL_ROUTES = (
	"audio-editor",
	"audio-recorder",
	"calculator",
	"countdown-timer",
	"currency-converter",
	"dictionary",
	"financial-calculators",
	"gst-calculator",
	"health-calculators",
	"hsn-sac-lookup",
	"ifsc-code-search",
	"pin-code-search",
	"script-conversion",
	"stopwatch",
	"timer",
	"unit-converter",
	"weather",
	"world-clock",
)

APP_ROUTES = (*APP_PAGES, *TOOL_ROUTES)

# A route that used to serve several tools behind a tab strip, and the tool a visitor arriving
# there should land on now. These are published URLs, so they keep working rather than 404.
#
# Each retired route is redirected straight to its replacement. Sending `/toolbox/<old>` to
# `/<old>` and letting that redirect again would cost every old link two round trips, and a
# search engine discounts a chain.
RETIRED_ROUTES = {
	"india-business-lookup": "pin-code-search",
}


def website_route_rules() -> list[dict[str, str]]:
	"""Route every app path to the single web page that boots the client app."""
	return [{"from_route": f"/{route}", "to_route": WEB_PAGE} for route in APP_ROUTES]


def website_redirects() -> list[dict[str, object]]:
	"""Keep every link that was published under the old `/toolbox` prefix working.

	The deployed site served `/toolbox/<route>` until this change, so these are permanent
	redirects rather than a courtesy.
	"""
	def permanent(source: str, target: str) -> dict[str, object]:
		return {
			"source": source,
			"target": target,
			"redirect_http_status": 308,
			"forward_query_parameters": True,
		}

	# The app used to land on /toolbox/all-tools. The root shows All Tools now, so both the old
	# landing route and the bare prefix collapse onto `/`.
	redirects = [
		permanent("/toolbox", "/"),
		permanent("/toolbox/all-tools", "/"),
		permanent("/all-tools", "/"),
	]
	redirects.extend(permanent(f"/toolbox/{route}", f"/{route}") for route in APP_ROUTES)

	for retired, replacement in RETIRED_ROUTES.items():
		redirects.append(permanent(f"/{retired}", f"/{replacement}"))
		redirects.append(permanent(f"/toolbox/{retired}", f"/{replacement}"))

	return redirects
