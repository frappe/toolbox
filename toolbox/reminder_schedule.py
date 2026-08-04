# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Pure recurrence and time-zone math for Reminders.

This module has no Frappe dependency so the risky scheduling logic can be unit-tested with
controlled time. It answers one question: given a reminder's anchor (the first occurrence's
local wall-clock date and time in a named IANA zone) and a recurrence rule, what is the UTC
instant of occurrence *n*?

Occurrences are always computed from the immutable anchor, never by adding to the previous
occurrence. This avoids two classic bugs:

- Drift and clamp errors, e.g. a monthly reminder anchored on the 31st must fire on Feb 28
  and then again on Mar 31, not settle onto the 28th.
- Wrong daylight-saving offsets: 09:00 local must stay 09:00 local across a DST boundary, so
  the wall-clock time is re-localised for every occurrence rather than shifted by fixed UTC
  seconds.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

REPEAT_NONE = "None"
REPEAT_DAILY = "Daily"
REPEAT_WEEKLY = "Weekly"
REPEAT_MONTHLY = "Monthly"
REPEAT_YEARLY = "Yearly"
REPEAT_TYPES = (REPEAT_NONE, REPEAT_DAILY, REPEAT_WEEKLY, REPEAT_MONTHLY, REPEAT_YEARLY)

# A guard against a pathological rule (e.g. an end date far in the past) making the search for
# the next future occurrence loop forever. Comfortably larger than any real reminder horizon.
_MAX_STEPS = 10_000


class InvalidTimeZone(ValueError):
	"""Raised when a reminder's stored time zone is not a known IANA identifier."""


def resolve_timezone(tz_name: str) -> ZoneInfo:
	try:
		return ZoneInfo(tz_name)
	except (ZoneInfoNotFoundError, ValueError) as exc:
		raise InvalidTimeZone(f"Unknown time zone: {tz_name!r}") from exc


def occurrence_instant(
	anchor_date: date,
	anchor_time: time,
	tz_name: str,
	repeat_type: str,
	interval: int,
	n: int,
) -> datetime:
	"""Return the UTC instant (timezone-aware) of the ``n``-th occurrence (n counts from 0)."""
	tz = resolve_timezone(tz_name)
	local_date = occurrence_local_date(anchor_date, repeat_type, interval, n)
	return _localize_to_utc(datetime.combine(local_date, anchor_time), tz)


def occurrence_local_date(anchor_date: date, repeat_type: str, interval: int, n: int) -> date:
	"""Local calendar date of occurrence ``n``, computed from the anchor with day clamping."""
	step = _normalize_interval(interval)
	if n == 0 or repeat_type == REPEAT_NONE:
		return anchor_date
	if repeat_type == REPEAT_DAILY:
		return anchor_date + timedelta(days=step * n)
	if repeat_type == REPEAT_WEEKLY:
		return anchor_date + timedelta(weeks=step * n)
	if repeat_type == REPEAT_MONTHLY:
		return _add_months(anchor_date, step * n)
	if repeat_type == REPEAT_YEARLY:
		return _add_months(anchor_date, 12 * step * n)
	raise ValueError(f"Unknown repeat type: {repeat_type!r}")


def first_trigger(
	anchor_date: date,
	anchor_time: time,
	tz_name: str,
	repeat_type: str,
	interval: int,
	not_before: datetime,
	repeat_end_date: date | None = None,
) -> datetime | None:
	"""Return the UTC instant of the first occurrence to schedule when a reminder is saved.

	A one-time reminder always resolves to its single occurrence, even one in the past, so the
	scheduler fires it once on the next tick. A recurring reminder rolls forward to the first
	occurrence at or after ``not_before`` that still falls on or before ``repeat_end_date``.
	Returns ``None`` when a recurrence has no occurrence left within its end date.
	"""
	if repeat_type == REPEAT_NONE:
		return occurrence_instant(anchor_date, anchor_time, tz_name, repeat_type, interval, 0)
	return _scan(anchor_date, anchor_time, tz_name, repeat_type, interval, not_before, repeat_end_date)


def next_trigger(
	anchor_date: date,
	anchor_time: time,
	tz_name: str,
	repeat_type: str,
	interval: int,
	after: datetime,
	not_before: datetime,
	repeat_end_date: date | None = None,
) -> datetime | None:
	"""Return the UTC instant of the next occurrence strictly after ``after``.

	Advancement is anchored to the occurrence instant, not to a stored index, so snooze — which
	simply re-points a reminder's next fire — resumes the series from the next real occurrence
	after the snoozed time with no separate bookkeeping. Occurrences already in the past relative
	to ``not_before`` are skipped so a dormant reminder does not fire a burst of catch-up
	notifications. ``None`` means the recurrence has ended.
	"""
	if repeat_type == REPEAT_NONE:
		return None
	return _scan(
		anchor_date, anchor_time, tz_name, repeat_type, interval, not_before, repeat_end_date, after
	)


def _scan(
	anchor_date: date,
	anchor_time: time,
	tz_name: str,
	repeat_type: str,
	interval: int,
	not_before: datetime,
	repeat_end_date: date | None,
	after: datetime | None = None,
) -> datetime | None:
	"""First occurrence at/after ``not_before`` (and strictly after ``after`` when given)."""
	for index in range(_MAX_STEPS):
		local_date = occurrence_local_date(anchor_date, repeat_type, interval, index)
		if repeat_end_date and local_date > repeat_end_date:
			return None
		instant = occurrence_instant(anchor_date, anchor_time, tz_name, repeat_type, interval, index)
		if instant >= not_before and (after is None or instant > after):
			return instant
	return None


def _localize_to_utc(naive_local: datetime, tz: ZoneInfo) -> datetime:
	"""Convert a naive wall-clock time in ``tz`` to a UTC instant, resolving DST explicitly.

	``fold=0`` gives the two DST edge cases the intended, documented behaviour:

	- Spring-forward gap (a wall time that never happens): the conversion lands just after the
	  transition, i.e. the reminder fires shifted forward by the skipped hour.
	- Fall-back overlap (a wall time that happens twice): the earlier of the two instants is used.
	"""
	return naive_local.replace(tzinfo=tz, fold=0).astimezone(timezone.utc)


def _add_months(anchor: date, months: int) -> date:
	"""Add ``months`` to ``anchor``, clamping the day to the last valid day of the target month."""
	total = anchor.month - 1 + months
	year = anchor.year + total // 12
	month = total % 12 + 1
	last_day = calendar.monthrange(year, month)[1]
	return date(year, month, min(anchor.day, last_day))


def _normalize_interval(interval: int) -> int:
	return interval if interval and interval >= 1 else 1
