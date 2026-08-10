# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""One import at a time, from the first row to the commit.

`frappe.db.advisory_lock` is a MariaDB `GET_LOCK`. The lock belongs to the database session, not to
the transaction, so it is released the moment the `with` block ends. An importer that returns
without committing therefore drops the lock while its rows are still uncommitted and still holding
their row locks. A second import then takes the lock, believes it is alone, and blocks on rows the
first import has not finished writing.

Holding the lock until the commit closes that window. Every dataset importer takes its lock through
this, so the rule has one home rather than five.
"""

from contextlib import contextmanager

import frappe

# Long enough that a second import waits through a slow batch, short enough that a caller learns
# quickly rather than hanging.
LOCK_TIMEOUT = 30


@contextmanager
def dataset_import_lock(key: str, timeout: int = LOCK_TIMEOUT):
	"""Hold `key` until the work inside has been committed.

	The commit runs on the way out, so it happens while the lock is still held. A failing import
	commits nothing here: it raises through this, and the importer has already recorded the
	failure and committed that.
	"""
	with frappe.db.advisory_lock(key, timeout=timeout):
		yield
		frappe.db.commit()
