# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU Affero General Public License v3

# The confusable characters below are the subject of this module, not a mistake in it.
# ruff: noqa: RUF001, RUF003

"""How a place name is folded for search.

The importer folds every name it stores and the search folds every query, so the two must
agree exactly or a city becomes unreachable. That is why this rule lives alone, in a module
that imports nothing from Frappe: `scripts/build_city_dataset.py` reads it too, and runs
outside a bench.
"""

from __future__ import annotations

import unicodedata

# NFKD turns "ü" into "u" plus a combining mark, which stripping marks then removes. It leaves
# these alone, because they are letters in their own right rather than accented forms of one.
# Without them "Tromsø", "Łódź" and "Diyarbakır" cannot be typed on an ASCII keyboard.
_LETTERS = {
	"ø": "o",
	"æ": "ae",
	"œ": "oe",
	"ß": "ss",
	"ł": "l",
	"đ": "d",
	"ð": "d",
	"þ": "th",
	"ı": "i",
	"ə": "e",
	"ŋ": "n",
	"ħ": "h",
	"ŧ": "t",
}
# Typographic punctuation nobody types. "Xi’an" has to answer to "xian" and to "xi'an".
_PUNCTUATION = {"’": "", "‘": "", "ʻ": "", "ʼ": "", "'": "", "`": "", "´": "", "–": "-", "—": "-", "‐": "-"}
_SUBSTITUTIONS = str.maketrans({**_LETTERS, **_PUNCTUATION})


def search_name(value: object) -> str:
	"""Fold a place name or a query the same way, so that "Zurich" finds "Zürich"."""
	decomposed = unicodedata.normalize("NFKD", str(value or ""))
	unmarked = "".join(char for char in decomposed if not unicodedata.combining(char))
	return " ".join(unmarked.casefold().translate(_SUBSTITUTIONS).split())
