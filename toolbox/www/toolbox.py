import frappe

from toolbox import seo, tool_content

no_cache = 1


def get_context():
	# Toolbox is a free public website. It has no accounts and stores no user data, so every
	# visitor is a Guest and the page renders the same for all of them. The boot payload carries
	# only what the shell needs to talk to the server for reference data.
	context = frappe._dict()
	context.no_cache = 1
	# One template serves every route, so the head is built from the path that was asked for.
	# A crawler runs no JavaScript before it decides what a page is about.
	path = requested_path()
	context.seo = seo.page_metadata(path, frappe.utils.get_url())
	# The heading and the content of the page, rendered into the element the application mounts
	# on. Vue empties that element when it mounts, so this is what a crawler and a visitor with no
	# JavaScript read, and nobody reads it twice.
	context.page_content = tool_content.page_content(seo.normalise_path(path))
	context.boot = frappe._dict(
		{
			"csrf_token": frappe.sessions.get_csrf_token(),
			"site_name": frappe.local.site,
			# The client sets the title again after an in-app navigation, where no new server
			# response arrives. It reuses these rather than composing its own, because two
			# titles for one page is a contradiction a crawler can see.
			"toolbox_page_titles": seo.route_titles(),
		}
	)
	return context


def requested_path() -> str:
	"""Return the path the visitor asked for, not the template the route map chose.

	`resolve_from_map` rewrites the path to `toolbox` before a renderer is picked, so the
	resolved path names the template for all 16 routes and cannot tell them apart. The request
	still carries the original URL.
	"""
	request = getattr(frappe.local, "request", None)
	return getattr(request, "path", "") or ""
