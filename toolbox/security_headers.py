# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""The Content-Security-Policy Toolbox serves, in report-only mode.

Frappe Cloud's proxy already adds `X-Frame-Options`, `Strict-Transport-Security`,
`X-Content-Type-Options` and a referrer policy. It adds no CSP, and Frappe sets one only for web
forms, so this is the application's own.

It is **report-only** on purpose. An enforcing policy that is one directive too strict breaks the
site for real visitors, and the first anyone hears of it is a bug report. Report-only sends the
same policy, changes nothing a visitor sees, and asks the browser to say what it *would* have
blocked. `frontend/e2e/csp.spec.js` walks every route with the browser listening for those reports,
so the answer arrives from the test suite rather than from production.

Switch the header name to `Content-Security-Policy` once that spec has been quiet across a full
run, and read `qa/README.md` before you do.

**One thing stands between this and enforcing, and it is issue #266.** frappe-ui bundles and starts
a socket.io client that Toolbox has no feature for. It calls `Function("return this")` at module
load, which counts as eval, and then tries to reach the realtime port. Both are reported on every
route. The fix is to stop shipping the client rather than to add `unsafe-eval` and widen
`connect-src`: allowing eval is most of what a policy is meant to prevent.
"""

# Everything Toolbox loads comes from its own origin. There are no web fonts, no analytics, no CDN
# and no third-party script: the built HTML references no external host at all, and the provider
# calls to the ECB and the dataset releases are made by the server, never by the browser.
#
# The two `unsafe-inline` allowances are known, and each has a reason:
#
# - `style-src`, because Vue attaches scoped styles and Tailwind emits inline custom properties.
#   Removing it needs a nonce threaded through the render, which Frappe does not offer here.
# - `script-src`, because the theme bootstrap is an inline script by design. It reads the stored
#   theme and sets `data-theme` before the first paint, which is what stops a returning dark-mode
#   visitor being flashed a white page. A nonce would let this one go, and that is the next step
#   worth taking once the policy is enforced.
POLICY = {
	"default-src": "'self'",
	"base-uri": "'self'",
	"object-src": "'none'",
	"frame-ancestors": "'self'",
	"form-action": "'self'",
	"script-src": "'self' 'unsafe-inline'",
	"style-src": "'self' 'unsafe-inline'",
	# `blob:` is the Audio Recorder and the Audio Editor, which build a clip in the browser and
	# hand it to an <audio> element and a download. `data:` covers the inline PWA icons.
	"img-src": "'self' data: blob:",
	"media-src": "'self' blob:",
	"font-src": "'self' data:",
	"connect-src": "'self'",
	"worker-src": "'self' blob:",
	"manifest-src": "'self'",
}

HEADER = "Content-Security-Policy-Report-Only"


def add_security_headers(response=None, request=None) -> None:
	"""Attach the policy to every HTML response. Registered as an `after_request` hook."""
	if response is None or not _is_html(response):
		return

	# Never overwrite a policy set upstream. If the proxy grows one, that one wins.
	if HEADER in response.headers or "Content-Security-Policy" in response.headers:
		return

	response.headers[HEADER] = build_policy()


def build_policy() -> str:
	return "; ".join(f"{directive} {value}" for directive, value in POLICY.items())


def _is_html(response) -> bool:
	"""A policy on a JSON API response protects nothing and confuses a reader of the headers.

	This runs on every response, so it stays quiet on anything unexpected. Writing to the Error Log
	from here would need a database on a request that may already be tearing one down, and a header
	that failed to attach is not worth risking the response itself for.
	"""
	try:
		return "text/html" in (response.headers.get("Content-Type") or "")
	except Exception:
		return False
