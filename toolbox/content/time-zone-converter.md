## How it works

You give the tool one moment: a date, a time, and the city whose clock that time is on. Every card
then shows the same moment, written in its own city's clock.

1. Pick the date and the time.
2. Name the city whose clock that time is on.
3. Read the answer on every card, with its date and its offset.
4. Press Copy times to put every card on the clipboard, one line each.

Add a city with the search box. It covers the identifier, a city name, its region and the names it
is also known by, so Bombay finds Mumbai and Vizag finds Visakhapatnam. Up to 12 cards are kept, and
the same list serves the [World Clock](/world-clock).

The offset is worked out for the moment you chose, not looked up in a table. The tool writes that
moment out in the zone, reads it back, and compares the two. The difference is the offset, taken
from the browser's own IANA time-zone data. This matters because an offset is not a property of a
city. It is a property of a city on a date.

## Worked examples

### A 09:30 meeting in New York, in January and in July

On 14 January 2026, 09:30 in New York is **14:30** in London, **20:00** in Kolkata, and **01:30 on
15 January** in Sydney. The Sydney card reads Next day.

On 14 July 2026 the same 09:30 in New York is **14:30** in London, **19:00** in Kolkata, and
**23:30** in Sydney, on the same day. London moved with New York, so that gap held. Kolkata and
Sydney did not, so both changed.

### The three weeks when London and New York are four hours apart

The two are usually five hours apart, and for three weeks each March they are four. On 1 March 2026,
12:00 in London is **07:00** in New York. On 10 March it is **08:00**. On 1 April it is **07:00**
again.

New York moves its clocks forward on the second Sunday in March, and London on the last Sunday. In
between, New York has moved and London has not.

## Frequently asked questions

### What is the difference between this and the World Clock?

The [World Clock](/world-clock) answers "what time is it there now". This answers "what time is
that there". Both read the same list of cities, so a city added on one page is on the other.

### Which city's clock is my time on?

The one named in the second field. It starts on the zone your device is set to, as the browser
reports it. Change it when the time you are converting belongs to somewhere else.

### Why does a card show a different offset in summer?

Because that city moves its clocks. London is UTC in January and UTC+01:00 in July. The offset shown
is the one that applied on the date you chose, which is why converting a date in July and a date in
January can give two different answers for the same clock time.

### Why does a card say Daylight saving time in January?

Because it is summer in the southern half of the world. Sydney reads UTC+11:00 and Daylight saving
time in January, and UTC+10:00 and Standard time in July.

### Can I share the times with other people?

Press Copy times. Every card goes to the clipboard as one line, with the name, the date, the time
and the offset. Some browsers do not let a page write to the clipboard at all.

### Does this work offline?

Yes. The zone rules are already in the browser, so no request is made. The cities stay while the
browser tab is open, and go when it closes. There is no account, and nothing is sent to a server.

## Good to know

An hour is skipped every spring and repeated every autumn. When New York moves its clocks forward at
02:00 on 8 March 2026, the times from 02:00 to 02:59 do not happen there. A tool asked to convert
one of them has to choose an answer, because the moment does not exist.

To convert a length of time rather than a point in it, use the
[Time Unit Converter](/time-unit-converter). Hours into days is a different question from 09:30 in
New York into Kolkata.

The IANA time-zone database holds one zone for each region whose clocks have agreed since 1970. A
zone is named `Area/Location`, and the location is usually a large city rather than a country,
because a country can split, be renamed or change its offset, while a city stays put.
