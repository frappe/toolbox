from urllib.parse import quote

import frappe

no_cache = 1


def get_context():
	# Toolbox is a single-owner, authenticated-only application. Guests never receive the
	# app shell: send them to the Frappe login and return to the page they asked for.
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = f"/login?redirect-to={quote(_requested_path())}"
		raise frappe.Redirect

	context = frappe._dict()
	context.no_cache = 1
	context.boot = frappe._dict(
		{
			"csrf_token": frappe.sessions.get_csrf_token(),
			"is_logged_in": frappe.session.user != "Guest",
			"site_name": frappe.local.site,
			"user": frappe.session.user,
			"full_name": frappe.utils.get_fullname(frappe.session.user),
		}
	)
	return context


def _requested_path() -> str:
	# Preserve the deep link (e.g. /toolbox/calculator) so login returns to the intended tool.
	request = getattr(frappe.local, "request", None)
	path = getattr(request, "path", None)
	return path or "/toolbox/all-tools"
