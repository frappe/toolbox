# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

"""MET Norway weather symbols translated to WMO 4677 present-weather codes.

MET describes conditions with names such as `partlycloudy_night`, while the Weather tool's
frontend contract carries a WMO integer. The table below is the full MET vocabulary, taken
from https://github.com/metno/weathericons (`weather/legend.csv`), so an unrecognised symbol
means MET added one rather than that a case was overlooked.

Two mappings lose detail, and both do so deliberately:

- MET marks thunder on twelve symbols without grading it. WMO grades thunderstorms by hail
  (95, 96, 99), which is a different question, so every thunder symbol becomes a plain 95.
- WMO pairs light with slight and folds moderate in with heavy, so MET's three intensities
  land on two codes for sleet, sleet showers, and snow showers.
"""

from __future__ import annotations

# MET appends _day, _night, or _polartwilight to any symbol whose icon varies with daylight.
_DAYLIGHT_SUFFIXES = ("_day", "_night", "_polartwilight")

# MET symbol -> WMO 4677. The two "lights" spellings are MET's own typos, present in the
# published legend and in live responses, so they are matched as they are sent.
SYMBOL_CODES = {
	"clearsky": 0,
	"fair": 1,
	"partlycloudy": 2,
	"cloudy": 3,
	"fog": 45,
	"lightrain": 61,
	"rain": 63,
	"heavyrain": 65,
	"lightsleet": 68,
	"sleet": 69,
	"heavysleet": 69,
	"lightsnow": 71,
	"snow": 73,
	"heavysnow": 75,
	"lightrainshowers": 80,
	"rainshowers": 81,
	"heavyrainshowers": 82,
	"lightsleetshowers": 83,
	"sleetshowers": 84,
	"heavysleetshowers": 84,
	"lightsnowshowers": 85,
	"snowshowers": 86,
	"heavysnowshowers": 86,
	"lightrainandthunder": 95,
	"rainandthunder": 95,
	"heavyrainandthunder": 95,
	"lightsleetandthunder": 95,
	"sleetandthunder": 95,
	"heavysleetandthunder": 95,
	"lightsnowandthunder": 95,
	"snowandthunder": 95,
	"heavysnowandthunder": 95,
	"lightrainshowersandthunder": 95,
	"rainshowersandthunder": 95,
	"heavyrainshowersandthunder": 95,
	"lightssleetshowersandthunder": 95,
	"sleetshowersandthunder": 95,
	"heavysleetshowersandthunder": 95,
	"lightssnowshowersandthunder": 95,
	"snowshowersandthunder": 95,
	"heavysnowshowersandthunder": 95,
}


def wmo_code(symbol_code: object) -> int | None:
	"""Return the WMO code for a MET symbol, or None if the symbol is absent or unknown."""
	if not isinstance(symbol_code, str):
		return None
	base = symbol_code.strip().casefold()
	for suffix in _DAYLIGHT_SUFFIXES:
		if base.endswith(suffix):
			base = base[: -len(suffix)]
			break
	return SYMBOL_CODES.get(base)
