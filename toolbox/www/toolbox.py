import frappe

no_cache = 1


def get_context():
	# Toolbox is a free public website. It has no accounts and stores no user data, so every
	# visitor is a Guest and the page renders the same for all of them. The boot payload carries
	# only what the shell needs to talk to the server for reference data.
	context = frappe._dict()
	context.no_cache = 1
	context.boot = frappe._dict(
		{
			"csrf_token": frappe.sessions.get_csrf_token(),
			"site_name": frappe.local.site,
		}
	)
	return context
