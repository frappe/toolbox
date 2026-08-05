# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Deterministic expense categorisation. No remote AI, no model — pure rules.

The suggestion precedence (spec 11.9) is, highest first:

1. A user rule (exact / starts-with / contains / regex on merchant, description, or both),
   ordered by the rule's own priority then by match specificity.
2. The category the user previously confirmed for the same normalised merchant.
3. A built-in keyword rule.
4. No suggestion.

Every suggestion carries a confidence class and a plain explanation so the UI can show why a
category was proposed and never silently apply a low-confidence guess. This module is
Frappe-free so the precedence can be unit-tested directly; the caller supplies the user's rules,
the prior-choice lookup, and (by default) the built-in keyword map.
"""

from __future__ import annotations

import re

CONFIDENCE_HIGH = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW = "low"

FIELD_DESCRIPTION = "description"
FIELD_MERCHANT = "merchant"
FIELD_COMBINED = "combined"
MATCH_FIELDS = (FIELD_DESCRIPTION, FIELD_MERCHANT, FIELD_COMBINED)

MATCH_EXACT = "exact"
MATCH_CONTAINS = "contains"
MATCH_STARTS_WITH = "starts_with"
MATCH_REGEX = "regex"
MATCH_TYPES = (MATCH_EXACT, MATCH_CONTAINS, MATCH_STARTS_WITH, MATCH_REGEX)

# Guardrails so a user regular expression cannot hang the request (crude ReDoS mitigation:
# bound both the pattern and the text it runs against).
MAX_PATTERN_LENGTH = 200
MAX_MATCH_TEXT = 500

# Lower rank wins. Encodes the spec's default precedence when two rules share a priority.
_MATCH_TYPE_RANK = {MATCH_EXACT: 0, MATCH_STARTS_WITH: 1, MATCH_CONTAINS: 2, MATCH_REGEX: 3}
_FIELD_RANK = {FIELD_MERCHANT: 0, FIELD_DESCRIPTION: 1, FIELD_COMBINED: 2}

_HIGH_CONFIDENCE_MATCHES = frozenset({MATCH_EXACT, MATCH_STARTS_WITH, MATCH_REGEX})

# Ordered built-in keywords -> category name. First match wins, so keep more specific terms
# ahead of generic ones. Categories here must match the shipped default category names.
BUILTIN_KEYWORDS: tuple[tuple[str, str], ...] = (
	("swiggy", "Food and Dining"), ("zomato", "Food and Dining"), ("restaurant", "Food and Dining"),
	("cafe", "Food and Dining"), ("coffee", "Food and Dining"), ("starbucks", "Food and Dining"),
	("bigbasket", "Groceries"), ("grocery", "Groceries"), ("supermarket", "Groceries"),
	("dmart", "Groceries"), ("blinkit", "Groceries"), ("zepto", "Groceries"),
	("uber", "Transport"), ("ola", "Transport"), ("lyft", "Transport"), ("taxi", "Transport"),
	("metro", "Transport"), ("petrol", "Transport"), ("diesel", "Transport"), ("fuel", "Transport"),
	("irctc", "Travel"), ("flight", "Travel"), ("indigo", "Travel"), ("train", "Travel"),
	("hotel", "Accommodation"), ("airbnb", "Accommodation"), ("hostel", "Accommodation"),
	("amazon", "Shopping"), ("flipkart", "Shopping"), ("myntra", "Shopping"), ("mall", "Shopping"),
	("electricity", "Utilities"), ("broadband", "Utilities"), ("internet", "Utilities"),
	("recharge", "Utilities"), ("water bill", "Utilities"), ("gas bill", "Utilities"),
	("rent", "Housing"), ("maintenance", "Housing"),
	("pharmacy", "Health"), ("hospital", "Health"), ("clinic", "Health"), ("doctor", "Health"),
	("medical", "Health"), ("apollo", "Health"),
	("school", "Education"), ("tuition", "Education"), ("course", "Education"), ("udemy", "Education"),
	("movie", "Entertainment"), ("cinema", "Entertainment"), ("pvr", "Entertainment"),
	("salon", "Personal Care"), ("spa", "Personal Care"), ("haircut", "Personal Care"),
	("netflix", "Subscriptions"), ("spotify", "Subscriptions"), ("prime", "Subscriptions"),
	("subscription", "Subscriptions"),
	("gift", "Gifts"),
	("fee", "Fees"), ("charge", "Fees"),
)


def categorize(
	merchant: str,
	description: str,
	rules: list[dict],
	prior_choices: dict[str, str] | None = None,
	builtin_keywords: tuple[tuple[str, str], ...] = BUILTIN_KEYWORDS,
) -> dict:
	"""Return the best category suggestion. ``rules`` are the user's active rules (any order)."""
	prior_choices = prior_choices or {}

	for rule in _sorted_rules(rules):
		if _rule_matches(rule, merchant, description):
			match_type = rule.get("match_type")
			confidence = CONFIDENCE_HIGH if match_type in _HIGH_CONFIDENCE_MATCHES else CONFIDENCE_MEDIUM
			return _suggestion(
				rule.get("category"),
				confidence,
				f"Matched your rule “{rule.get('rule_name') or rule.get('pattern')}”.",
				rule_name=rule.get("name"),
				payment_method=rule.get("payment_method"),
				tags=rule.get("tags"),
			)

	key = normalise(merchant)
	if key and key in prior_choices:
		return _suggestion(
			prior_choices[key],
			CONFIDENCE_MEDIUM,
			"You used this category before for the same merchant.",
		)

	combined = normalise(_field_text(FIELD_COMBINED, merchant, description))
	for keyword, category in builtin_keywords:
		if keyword in combined:
			return _suggestion(
				category, CONFIDENCE_LOW, f"A built-in keyword “{keyword}” suggests this category."
			)

	return _suggestion(None, None, "No confident match — please pick a category.")


def validate_pattern(match_type: str, pattern: str) -> None:
	"""Raise ``ValueError`` for an unusable rule pattern (empty, too long, or invalid regex)."""
	pattern = (pattern or "").strip()
	if not pattern:
		raise ValueError("A rule needs a pattern to match.")
	if len(pattern) > MAX_PATTERN_LENGTH:
		raise ValueError("The rule pattern is too long.")
	if match_type == MATCH_REGEX:
		try:
			re.compile(pattern)
		except re.error as exc:
			raise ValueError(f"That is not a valid regular expression: {exc}") from exc


def normalise(text: object) -> str:
	"""Lowercase and collapse whitespace for stable exact/contains matching."""
	return " ".join(str(text or "").split()).lower()


def _sorted_rules(rules: list[dict]) -> list[dict]:
	return sorted(
		rules,
		key=lambda r: (
			int(r.get("priority") or 0),
			_MATCH_TYPE_RANK.get(r.get("match_type"), 9),
			_FIELD_RANK.get(r.get("match_field"), 9),
		),
	)


def _rule_matches(rule: dict, merchant: str, description: str) -> bool:
	match_type = rule.get("match_type")
	raw = _field_text(rule.get("match_field"), merchant, description)[:MAX_MATCH_TEXT]
	pattern = (rule.get("pattern") or "").strip()
	if not pattern:
		return False
	if match_type == MATCH_REGEX:
		if len(pattern) > MAX_PATTERN_LENGTH:
			return False
		try:
			return re.search(pattern, raw, re.IGNORECASE) is not None
		except re.error:
			return False
	text = normalise(raw)
	needle = normalise(pattern)
	if match_type == MATCH_EXACT:
		return text == needle
	if match_type == MATCH_STARTS_WITH:
		return text.startswith(needle)
	if match_type == MATCH_CONTAINS:
		return needle in text
	return False


def _field_text(field: str | None, merchant: str, description: str) -> str:
	merchant = merchant or ""
	description = description or ""
	if field == FIELD_MERCHANT:
		return merchant
	if field == FIELD_DESCRIPTION:
		return description
	return f"{merchant} {description}".strip()


def _suggestion(
	category: str | None,
	confidence: str | None,
	explanation: str,
	rule_name: str | None = None,
	payment_method: str | None = None,
	tags: object = None,
) -> dict:
	return {
		"category": category,
		"confidence": confidence,
		"explanation": explanation,
		"rule_name": rule_name,
		"payment_method": payment_method,
		"tags": tags,
	}
