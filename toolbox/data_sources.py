# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""What every dataset the site serves is made of, in one answer.

Each lookup tool already reports the release behind it, and each reports only its own. A visitor who
wants to know what Toolbox is built from should not have to open five tools to find out. This reads
the release ledger once and returns the active release for every dataset.

The copy that describes a tool lives with the page. Only facts come from here: the version, the
dates, how many rows the release holds, and the licence it carries.
"""

import frappe
from frappe.rate_limiter import rate_limit

from toolbox.india_business_data import RELEASE_DOCTYPE

# The datasets a visitor can see the effects of, in the order the page reads them.
DATASET_TYPES = ("PIN", "IFSC", "HSN", "Dictionary", "City")

RELEASE_FIELDS = (
	"dataset_type",
	"version",
	"source_updated_at",
	"imported_at",
	"record_count",
	"exclusion_count",
	"source_name",
	"source_url",
	"license_name",
	"license_url",
	"attribution",
)


@frappe.whitelist(allow_guest=True, methods=["GET"])
@rate_limit(limit=100, seconds=60)
@frappe.read_only()
def get_data_sources() -> dict[str, object]:
	"""Return the active release of every dataset, in a fixed order.

	A dataset with no active release is reported as such rather than left out. A page that lists
	four datasets where five are expected says nothing about which one is missing.
	"""
	active = {release.dataset_type: release for release in _active_releases()}
	return {
		"schemaVersion": 1,
		"datasets": [_dataset(dataset_type, active.get(dataset_type)) for dataset_type in DATASET_TYPES],
	}


def _active_releases() -> list[frappe._dict]:
	return frappe.get_all(
		RELEASE_DOCTYPE,
		filters={"status": "Active", "dataset_type": ("in", DATASET_TYPES)},
		fields=list(RELEASE_FIELDS),
		limit=len(DATASET_TYPES),
	)


def _dataset(dataset_type: str, release: frappe._dict | None) -> dict[str, object]:
	if not release:
		return {"datasetType": dataset_type, "active": False}
	return {
		"datasetType": dataset_type,
		"active": True,
		"version": release.version,
		"sourceUpdatedAt": release.source_updated_at,
		"importedAt": release.imported_at,
		"recordCount": release.record_count,
		"exclusionCount": release.exclusion_count,
		"source": {
			"name": release.source_name,
			"url": release.source_url,
			"license": release.license_name,
			"licenseUrl": release.license_url,
			"attribution": release.attribution,
		},
	}
