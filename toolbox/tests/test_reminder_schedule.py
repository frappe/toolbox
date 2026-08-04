# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3
"""Controlled-time unit tests for the pure recurrence and DST math (no database)."""

import unittest
from datetime import date, datetime, time, timezone

from toolbox.reminder_schedule import (
	InvalidTimeZone,
	first_trigger,
	next_trigger,
	occurrence_instant,
	occurrence_local_date,
	resolve_timezone,
)

NY = "America/New_York"
UTC = timezone.utc


def _utc(year, month, day, hour, minute=0):
	return datetime(year, month, day, hour, minute, tzinfo=UTC)


class TestOccurrenceLocalDate(unittest.TestCase):
	def test_daily_interval(self):
		anchor = date(2026, 1, 1)
		dates = [occurrence_local_date(anchor, "Daily", 3, n) for n in range(3)]
		self.assertEqual(dates, [date(2026, 1, 1), date(2026, 1, 4), date(2026, 1, 7)])

	def test_weekly_interval(self):
		anchor = date(2026, 1, 1)
		self.assertEqual(occurrence_local_date(anchor, "Weekly", 2, 2), date(2026, 1, 29))

	def test_monthly_clamps_and_restores_day(self):
		# Anchored on the 31st: Feb has no 31st (clamp to 28), but March restores the 31st.
		anchor = date(2026, 1, 31)
		self.assertEqual(occurrence_local_date(anchor, "Monthly", 1, 1), date(2026, 2, 28))
		self.assertEqual(occurrence_local_date(anchor, "Monthly", 1, 2), date(2026, 3, 31))

	def test_yearly_leap_day(self):
		anchor = date(2024, 2, 29)
		self.assertEqual(occurrence_local_date(anchor, "Yearly", 1, 1), date(2025, 2, 28))
		self.assertEqual(occurrence_local_date(anchor, "Yearly", 1, 4), date(2028, 2, 29))

	def test_none_and_zero_return_anchor(self):
		anchor = date(2026, 5, 4)
		self.assertEqual(occurrence_local_date(anchor, "None", 1, 5), anchor)
		self.assertEqual(occurrence_local_date(anchor, "Daily", 1, 0), anchor)

	def test_interval_below_one_is_treated_as_one(self):
		anchor = date(2026, 1, 1)
		self.assertEqual(occurrence_local_date(anchor, "Daily", 0, 2), date(2026, 1, 3))


class TestTimeZoneAndDst(unittest.TestCase):
	def test_monthly_keeps_local_time_across_dst(self):
		# 09:00 New York must stay 09:00 local; the UTC hour shifts by one across the March DST
		# boundary (EST -05:00 in February, EDT -04:00 in March).
		feb = occurrence_instant(date(2026, 2, 15), time(9, 0), NY, "Monthly", 1, 0)
		mar = occurrence_instant(date(2026, 2, 15), time(9, 0), NY, "Monthly", 1, 1)
		self.assertEqual(feb, _utc(2026, 2, 15, 14))
		self.assertEqual(mar, _utc(2026, 3, 15, 13))

	def test_spring_forward_gap_shifts_forward(self):
		# 2026-03-08 02:30 does not exist (02:00 -> 03:00); it must resolve to 03:30 EDT.
		instant = occurrence_instant(date(2026, 3, 8), time(2, 30), NY, "None", 1, 0)
		self.assertEqual(instant, _utc(2026, 3, 8, 7, 30))
		self.assertEqual(instant.astimezone(resolve_timezone(NY)).hour, 3)

	def test_fall_back_overlap_uses_earlier_instant(self):
		# 2026-11-01 01:30 happens twice; the earlier (EDT -04:00) instant is chosen.
		instant = occurrence_instant(date(2026, 11, 1), time(1, 30), NY, "None", 1, 0)
		self.assertEqual(instant, _utc(2026, 11, 1, 5, 30))

	def test_invalid_time_zone_raises(self):
		with self.assertRaises(InvalidTimeZone):
			occurrence_instant(date(2026, 1, 1), time(9, 0), "Mars/Olympus", "None", 1, 0)


class TestFirstTrigger(unittest.TestCase):
	def test_one_time_in_past_still_scheduled_once(self):
		now = _utc(2026, 6, 1, 12)
		instant = first_trigger(date(2026, 1, 1), time(9, 0), NY, "None", 1, not_before=now)
		self.assertIsNotNone(instant)
		self.assertLess(instant, now)

	def test_recurring_rolls_forward_to_first_future_occurrence(self):
		# Daily 09:00 NY, anchored months ago; the first scheduled instant must be in the future.
		now = _utc(2026, 6, 1, 12)
		instant = first_trigger(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, not_before=now)
		self.assertGreaterEqual(instant, now)
		self.assertEqual(instant.astimezone(resolve_timezone(NY)).hour, 9)

	def test_recurring_past_end_date_returns_none(self):
		now = _utc(2026, 6, 1, 12)
		self.assertIsNone(
			first_trigger(
				date(2026, 1, 1),
				time(9, 0),
				NY,
				"Daily",
				1,
				not_before=now,
				repeat_end_date=date(2026, 3, 1),
			)
		)


class TestNextTrigger(unittest.TestCase):
	def test_advances_to_following_occurrence(self):
		fired = occurrence_instant(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, 0)
		expected = occurrence_instant(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, 1)
		instant = next_trigger(
			date(2026, 1, 1), time(9, 0), NY, "Daily", 1, after=fired, not_before=fired
		)
		self.assertEqual(instant, expected)

	def test_skips_missed_occurrences_up_to_now(self):
		# After firing occurrence 0, if the clock has jumped ahead, the next scheduled occurrence
		# must be strictly in the future rather than a backlog of missed days.
		fired = occurrence_instant(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, 0)
		now = _utc(2026, 1, 10, 12)
		instant = next_trigger(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, after=fired, not_before=now)
		self.assertGreaterEqual(instant, now)

	def test_snooze_resumes_series_after_the_snoozed_time(self):
		# Snooze re-points the next fire to an arbitrary instant; the series must resume from the
		# next real occurrence strictly after that snoozed time, not repeat it.
		snooze = _utc(2026, 1, 1, 15, 30)
		instant = next_trigger(
			date(2026, 1, 1), time(9, 0), NY, "Daily", 1, after=snooze, not_before=snooze
		)
		self.assertEqual(instant, occurrence_instant(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, 1))

	def test_none_repeat_has_no_next(self):
		now = _utc(2026, 1, 1, 0)
		self.assertIsNone(
			next_trigger(date(2026, 1, 1), time(9, 0), NY, "None", 1, after=now, not_before=now)
		)

	def test_end_date_terminates_recurrence(self):
		fired = occurrence_instant(date(2026, 1, 1), time(9, 0), NY, "Daily", 1, 0)
		self.assertIsNone(
			next_trigger(
				date(2026, 1, 1),
				time(9, 0),
				NY,
				"Daily",
				1,
				after=fired,
				not_before=fired,
				repeat_end_date=date(2026, 1, 1),
			)
		)
