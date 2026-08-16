# Other ideas to explore

Toolbox is a free public website. Anyone can use it without an account. This document records the
tools and ideas that Toolbox does not ship, and the reason for each one.

Read this document before you propose a feature. An idea listed here is not a bad idea. Most of
these ideas failed a product test, a license test, or a cost test that still applies today. A few
wait for a decision.

Each entry names the reason. When the reason stops being true, the idea becomes available again.

## Tools removed on 2026-08-13

### Weather

Removed after the first QA pass over the live site. The list is long, and Weather is the one tool
on it that a visitor already owns: a phone shows the forecast on its lock screen, and a search
engine answers "weather in Pune" above every result. It failed the product test the other tools
pass, which is that the tool must beat what the visitor already has.

It was also the most expensive tool to keep. It is the only one that calls a provider for every
visitor, the only one carrying a licence obligation to a named third party, and the only reader of
the bundled city dataset. Removing it takes all of that with it:

- the MET Norway forecast provider, its symbol map and its Sunrise cache
- the GeoNames city release, 34,080 cities and 23,992 alternate names, 928 KB in the repository
- the `Toolbox City Record` and `Toolbox City Alias` DocTypes, and their tables
- `city_names.py`, which owned the folding rule shared by the importer, the search and the build
  script

World Clock is not affected. It carries its own list of cities in the frontend and never asked the
server for one.

**What it would take to bring it back.** All of the above is in the history, and the reasoning for
each piece is recorded in the two entries below, "Weather without a license problem" and "City
names in a language other than English". Neither of those problems came back. What would have to
change is the product answer: a reason for a visitor to open Toolbox for a forecast rather than the
device already in their hand.

## Tools removed on 2026-08-09

Toolbox changed from an authenticated single-owner application to a free public website on
`frappe.tools`. The site holds no user accounts and stores no user data. Eight tools left the
product on that date.

### Tools that needed an account

These five tools stored personal records for a signed-in owner. Toolbox has no accounts now, so
none of them can work.

| Tool | Size | Reason beyond the account |
| --- | --- | --- |
| Expenses | ~2,491 lines, 6 backend modules, 6 DocTypes | The largest module in the app. It held financial records and uploaded receipts for members of the public. That creates data-protection duties that a free brand website should not carry. |
| Library | ~1,565 lines, 2 DocTypes | It ran an outbound metadata fetcher driven by user-supplied URLs. That is a live request surface open to anonymous input. |
| Reminders | ~1,236 lines, 2 DocTypes | It needed a 5-minute scheduler job and outgoing mail to strangers. A missed reminder becomes support load. |
| Checklists | ~1,316 lines, 4 DocTypes | It does not beat the checklist app already on the visitor's phone. |
| Notes | ~524 lines, 1 DocType | Same reason as Checklists. It was the lightest of the five. |

### Tools removed to keep the list focused

| Tool | Size | Reason |
| --- | --- | --- |
| Tone Generator | 139 lines, no server code | It works well. The tool list needed to stay short. Cheap to bring back. |
| Metronome | 165 lines, no server code | Same reason as Tone Generator. Cheap to bring back. |
| Audio Inspector | 74 lines, no server code | Almost nobody searches for it. |

Tone Generator and Metronome are the two easiest tools on this page to restore. Both run fully in
the browser. Both need no dataset, no server code, and no license review.

## Ideas explored and dropped

### Audio format converter with ffmpeg

Dropped in session 7. Every official `@ffmpeg/core` build is GPL-2.0, because it links x264, x265,
and LAME. No permissive prebuilt core exists. Toolbox uses browser-native audio instead, and exports
WAV, which needs no codec license.

Do not rebuild this with ffmpeg. A permissive WebAssembly build of the needed codecs would change
the answer.

### Speech to text

Parked on a privacy decision that never closed. The browser `SpeechRecognition` API sends audio to a
cloud service. An offline model such as Whisper through transformers.js keeps the audio private, but
the model download is large.

The privacy principle favors the offline option. The cost is the download size.

### Split, reorder, and rejoin in the Audio Editor

Declined in session 7. The editor stays at trim, fade, and gain, with WAV and Opus export.

### Wallet, shared expenses, and a password vault

Dropped during Phase 2 planning. A Splitwise-style shared expense tool needs more than one user.
Toolbox is a single-user product with no accounts, so the idea cannot work here.

A password vault holds the most sensitive data a person owns. A free public tool is the wrong place
for it.

### Calculation history across devices

Declined in session 10, because the history changes often and would inflate the preference record.
The no-account decision then removed the option completely. Toolbox now keeps history for the
browser session only, and limits it to the last 10 entries.

### Collaboration and multiple users

Never in scope. Toolbox is a single-user product. One person uses one browser. Nothing is shared.

### Merge into Frappe Suite

Dropped in session 12. Toolbox ships as a free public tool on `frappe.tools` instead. The goal is
brand awareness and customer acquisition for Frappe.

### Reminder integrations

Deferred when Reminders shipped, and now moot because Reminders is gone. The list held Frappe
Calendar (Event) integration, a Mail adapter, a linked-record picker, and a custom date-time snooze.

## Ideas we still want

### Language tools

Dictionary stays and grows. Synonyms and antonyms become **sections inside Dictionary**, not
separate tools. One word input answers all three questions. The placeholder text tells the visitor
so: type the word you want the meaning, synonyms, or antonyms of.

1. **Synonyms.** Done. The data was already loaded, because WordNet is built on synsets, so this
   needed a new section rather than a new dataset. The synonyms of every sense are gathered into
   one list for each part of speech, under the definitions.
2. **Antonyms.** WordNet records antonyms as an explicit relation. The current importer skips it.
   This needs an extended extractor and one re-import.

Transliteration already ships as Script Conversion, and moves into the same category.

### Translate

Dropped. No free option is both open and clear for commercial use. Bundled models are large. The
usable APIs charge. A cheap permissive option would change the answer.

### Weather without a license problem

Done, and recorded here because the reasoning matters. Open-Meteo publishes its data under
CC BY 4.0, which permits commercial use. The restriction sits in the free-tier service terms, which
allow non-commercial use only.

MET Norway Locationforecast 2.0 serves the same CC BY 4.0 data with no such service term. It needs
an identifying `User-Agent` with a contact address, and stays under 20 requests per second. Weather
uses it now, with MET's Sunrise 3.0 for sunrise and sunset.

Self-hosting Open-Meteo is also legal, because the server is AGPLv3 with Docker images. It needs
continuous ingest of multi-gigabyte model data. That is too much operations work for one tool.

### City names in a language other than English

Done. A city now carries the names it is known by locally, so "München", "Roma" and "Bombay" all
find their city.

The first plan was to take names from the `alternatenames` column of `cities15000.txt`, capped at
six per city for cities above 200,000 people. Measuring it showed that plan could not work, and
the reason is worth keeping. That column is **alphabetical**, not ranked, so the first six names
for Munich are "lungsod ng muenchen", "muc", "minca", "minche", "minga" and "mjunkhen", and
"münchen" sits at position 27. The cap lost 14 of 16 test names. The population floor was wrong
too: Venice has 51,298 people.

What works is `alternateNames.zip`, the dump that carries language tags. A name is kept when it is
tagged with one of the country's own languages or with English, or when GeoNames left it untagged
but marked it preferred, which is how romanisations such as "Moskva" are recorded. No cap and no
population floor are needed, because the language rule is self-limiting at a median of two names
per city. Colloquial names are dropped: Jakarta is "the Big Durian" and Murmansk is "the fish
capital", and neither is a search term.

### World Clock

Removed in #283. It showed the current time in a list of cities, side by side, with each offset and
whether daylight saving applied.

The reason is that the Time Zone Converter does the same job and more. The two shared one view and
one list of cities, and the converter opens on the current moment, so its cards read exactly what
the clock read. Keeping both meant two pages competing for overlapping searches, which is the
duplicate content the tab split was meant to end.

Nothing was lost in the code. `/world-clock` redirects to `/time-zone-converter`, the city search
and the IANA zone maths moved with it to `tools/time-zone-converter/`, and the only behaviour that
went is the ticking clock, which a converter should not have: figures that move while they are
being read are wrong here.

Bringing it back needs a reason why "what time is it there now" deserves its own URL when the
converter answers it on arrival.

### Tool history, recent searches and saved currency pairs

Removed in #281. Every calculator and converter kept its last ten results, the dictionary kept the
last ten words looked up, and the currency converter kept a list of saved pairs. All of it lived in
`sessionStorage` and went with the tab.

The reason is that none of it earned its place. Toolbox has no accounts, so a list that dies with
the tab is a list almost nobody returns to. It cost a panel down the right of five tools, which is
the space the result and the chart now use, and it kept a page from fitting in one screen. A log of
what a visitor worked out is also the most revealing thing the site could hold, and the site's own
claim is that it holds nothing.

Bringing it back needs a reason beyond "somebody might want it": evidence that visitors re-use an
earlier result inside one session, and a place for it that does not push the tool below the fold.

### Administrator controls for datasets

Toolbox ships PIN, IFSC, HSN, and Dictionary data as checksummed releases. An administrator cannot
yet import a release or change its status from the interface. Both actions need the command line.

## How to bring an idea back

1. Read the reason recorded above. Confirm that the reason no longer holds.
2. Check the tool against the product test. A visitor arrives from a search engine. The tool must
   give value in seconds, and must beat what the visitor already owns.
3. Confirm that the tool needs no account. Toolbox stores no user data.
4. Confirm the license of every dataset and every API, for commercial use.
5. Open an issue on `frappe/toolbox` that quotes the reason from this document.
