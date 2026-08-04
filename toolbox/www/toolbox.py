import frappe


no_cache = 1


def get_context():
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
