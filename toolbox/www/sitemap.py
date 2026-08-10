import frappe

from toolbox import seo

no_cache = 1
base_template_path = "www/sitemap.xml"


def get_context(context):
	"""List every Toolbox page a crawler should fetch.

	This replaces Frappe's own sitemap, which is built from its page list and from DocTypes with
	a web view. Toolbox tools are website route rules, so none of them appeared, and the sitemap
	offered Frappe's stock `/about` and `/contact` instead. `TemplatePage` searches installed
	apps in reverse order, and Toolbox is installed after Frappe, so this file wins.

	There is no `lastmod`. Frappe's sitemap stamps every entry with today's date, which tells a
	crawler that all of these pages changed today, every day. A date that is always wrong is
	worse than no date: a crawler that stops trusting it discounts the real ones later.
	"""
	base_url = frappe.utils.get_url()
	return {"links": [seo.absolute_url(base_url, route) for route in seo.indexable_routes()]}
