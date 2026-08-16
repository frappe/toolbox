from toolbox import routes as toolbox_routes

app_name = "toolbox"
app_title = "Toolbox"
app_publisher = "Frappe Technologies Pvt Ltd"
app_description = "Common calculators, converters, lookups, and everyday utilities"
app_email = "developers@frappe.io"
app_license = "agpl-3.0"

app_icon_url = "/assets/toolbox/toolbox-logo.svg"
app_icon_title = "Toolbox"
app_icon_route = "/"

add_to_apps_screen = [
	{
		"name": "toolbox",
		"logo": "/assets/toolbox/toolbox-logo.svg",
		"title": "Toolbox",
		"route": "/",
	}
]

# Toolbox owns the whole site, so its tools sit directly under `/`. See toolbox/routes.py for why
# the rules are an explicit list rather than a catch-all, and why `/` is a hook instead of a rule.
website_route_rules = toolbox_routes.website_route_rules()
website_redirects = toolbox_routes.website_redirects()
# `/` never reaches the route map: resolve_path turns an empty path into `index` and asks
# get_home_page() instead. This hook is a literal page name, and it is what puts the app there.
website_user_home_page = toolbox_routes.WEB_PAGE

# Send non-GET requests for this app's endpoints as native `application/json`
# bodies instead of form-encoded, per-key JSON-stringified values.
use_json_request_body = True

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "toolbox",
# 		"logo": "/assets/toolbox/logo.png",
# 		"title": "Toolbox",
# 		"route": "/toolbox",
# 		"has_permission": "toolbox.api.permission.has_app_permission",
# 	}
# ]

# Companion apps that extend a host app (instead of taking their own apps-screen icon) can pin
# their workspaces into the host app's workspace dock (rail) with this hook. Declaring it keeps
# the app off the apps screen, so it takes precedence over any add_to_apps_screen above. Who can
# see a pinned workspace is controlled by that workspace's own Roles table.
# add_to_workspace_dock = [
# 	{
# 		"app": "erpnext",
# 		"workspace": "My Workspace",
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/toolbox/css/toolbox.css"
# app_include_js = "/assets/toolbox/js/toolbox.js"

# include js, css files in header of web template
# web_include_css = "/assets/toolbox/css/toolbox.css"
# web_include_js = "/assets/toolbox/js/toolbox.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "toolbox/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "toolbox/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Setup Wizard
# ------------

# open a fresh site's setup in this app's own UI instead of the desk wizard.
# must be a non-desk route (not under /desk or /app); to customize setup within
# desk, use setup_wizard_stages / setup_wizard_complete instead.
# setup_wizard_url = "/toolbox/setup"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "toolbox.utils.jinja_methods",
# 	"filters": "toolbox.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "toolbox.install.before_install"
# after_install = "toolbox.install.after_install"

# Send a Content-Security-Policy with every HTML response, in report-only mode. Frappe Cloud's
# proxy adds the other four security headers and no CSP, and Frappe sets one only for web forms.
# See `toolbox/security_headers.py` for the policy and for what has to be true before it enforces.
after_request = [
	"toolbox.security_headers.add_security_headers",
]

# Pull any bundled dataset whose pinned version differs from what is active on this
# site (fresh installs self-provision; an app update that bumps a dataset applies it).
# One-time-per-version fetch of public data; no runtime or scheduled network calls.
after_migrate = [
	"toolbox.dataset_sync.after_migrate",
]

# Uninstallation
# ------------

# before_uninstall = "toolbox.uninstall.before_uninstall"
# after_uninstall = "toolbox.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "toolbox.utils.before_app_install"
# after_app_install = "toolbox.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "toolbox.utils.before_app_uninstall"
# after_app_uninstall = "toolbox.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "toolbox.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "toolbox.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

#
# Toolbox owns no per-user records, so nothing needs a scripted permission rule. The four
# remaining DocTypes are read-only reference data (PIN, IFSC, HSN, Dictionary) plus their
# release ledger.

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Toolbox hooks no document events. It creates no records of its own for a visitor.

# Scheduled Tasks
# ---------------
#
# Toolbox runs no scheduled work. The reminders cron went with the Reminders tool.

# Testing
# -------

# before_tests = "toolbox.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "toolbox.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "toolbox.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "toolbox.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["toolbox.utils.before_request"]
# after_request = ["toolbox.utils.after_request"]

# Job Events
# ----------
# before_job = ["toolbox.utils.before_job"]
# after_job = ["toolbox.utils.after_job"]

# after_file_upload = ["toolbox.utils.after_file_upload"]

# User Data Protection
# --------------------
#
# Nothing to declare. Toolbox holds no personal data: no accounts, no uploads, and every
# preference stays in the visitor's own browser.

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"toolbox.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True

# Require all whitelisted methods to have type annotations
require_type_annotated_api_methods = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
