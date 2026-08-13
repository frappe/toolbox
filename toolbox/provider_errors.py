"""One way to turn an upstream failure into the 503 a visitor sees, and a record of why.

The two are deliberately different. A visitor is told to try again later, because nothing else is
useful to them. The Error Log gets the exception, because a 503 on its own is the same message
whether MET Norway is down, the ECB changed a response, a request timed out, or this host cannot
resolve a name at all. Without the cause, every one of those looks identical from the outside, and
the only way to tell them apart is to reproduce the failure by hand (#221).
"""

import frappe
from frappe.exceptions import ServiceUnavailableError

# One record of a provider being down is a diagnosis. One per request during an outage is a table
# nobody can read, and a database write on every failed read.
LOG_INTERVAL_SECONDS = 300


def provider_unavailable(
	message: str,
	provider: str,
	cause: BaseException | None = None,
	note: str = "",
) -> ServiceUnavailableError:
	"""Record why `provider` failed, then return the error to raise for the visitor.

	Pass `cause` from an `except` clause. Pass `note` for a failure with no exception behind it,
	which needs a sentence saying what was wrong instead.
	"""
	if _first_failure_in_a_while(provider):
		try:
			frappe.log_error(
				title=f"Toolbox provider unavailable: {provider}",
				message=_why(cause, note),
				# The caller raises straight after this, and the rollback that follows would take
				# an ordinary insert with it. A deferred insert is written outside this
				# transaction.
				defer_insert=True,
			)
		except Exception:
			# Recording an outage must never turn a 503 into a 500. The visitor's answer does not
			# depend on this succeeding.
			frappe.logger("toolbox").error(f"Could not record a {provider} failure", exc_info=True)
	return ServiceUnavailableError(message)


def _why(cause: BaseException | None, note: str) -> str:
	if cause is None:
		return note or "No cause was recorded."
	return frappe.get_traceback(with_context=True) or repr(cause)


def _first_failure_in_a_while(provider: str) -> bool:
	key = f"toolbox:provider-unavailable-logged:{provider}"
	try:
		if frappe.cache.get_value(key):
			return False
		frappe.cache.set_value(key, 1, expires_in_sec=LOG_INTERVAL_SECONDS)
	except Exception:
		# A cache that cannot answer must not turn a provider outage into a second failure.
		return True
	return True
