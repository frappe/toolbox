import frappe

no_cache = 1
base_template_path = "www/robots.txt"


def get_context(context):
	"""Serve the rules from the repository rather than from a Website Settings field.

	Frappe answers `/robots.txt` from a Single field, which is site data. On an empty field it
	returns an empty body, which is what `frappe.tools` serves today. A value typed into the
	desk would have to be typed again on every deployment, and nothing in the repository would
	record what it said.
	"""
	return {"sitemap_url": frappe.utils.get_url("/sitemap.xml")}
