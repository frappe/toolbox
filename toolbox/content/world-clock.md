## How it works

Every card shows one moment, seen from one place. In Clocks that moment is now, refreshed every 30
seconds. In Time converter it is a moment you choose. Your own zone comes from the browser, which
reports the setting your device holds, as an IANA identifier such as `Asia/Kolkata`. No address
lookup is involved.

1. Add a city or a time zone. Type a name and pick a result.
2. Reorder a card, mark it with a star, or remove it. Up to 12 are kept.
3. Switch to Time converter, pick a date and time, and name the city whose clock it is on. Every
   card then shows that moment.
4. Press Copy times to put every card on the clipboard, one line each.

The offset is worked out for the moment on screen, not looked up in a table. The tool writes that
moment out in the zone, reads it back, and compares the two. The difference is the offset, taken
from the browser's own IANA time-zone data.

The badge beside it compares that offset with the zone's standard offset, which is the smaller of
its 1 January and its 1 July offset for the year.

The search covers the identifier, a city name, its region and the names it is also known by, so
Bombay finds Mumbai and Vizag finds Visakhapatnam. 85 cities are named, 28 of them in India, and
every other zone the browser knows stays searchable. Old names fold into modern ones, so
`Asia/Calcutta` appears as `Asia/Kolkata`.

## Worked examples

### 09:00 in Kolkata, seen from London and New York

On 14 January 2026, 09:00 in Kolkata is **03:30** in London and **22:30 on 13 January** in New York.
The New York card reads Previous day.

On 14 July 2026 the same 09:00 in Kolkata is **04:30** in London and **23:30 on 13 July** in New
York. Nothing moved in India. London and New York both put their clocks forward for the summer, so
each gap narrows by an hour.

### A city whose offset is not a whole number of hours

Kathmandu reads **UTC+05:45** all year and Kolkata reads **UTC+05:30** all year. Neither moves for
the summer, so both cards always read Standard time.

## Frequently asked questions

### Which time zone does it use for me?

The one your device is set to, as the browser reports it. It is an IANA identifier, shown under each
card's name. Every Same day, Previous day or Next day line is measured against it.

### Why does a city show a different offset in summer?

Because it moves its clocks. London is UTC in January and UTC+01:00 in July. The offset is worked
out for the moment on screen, so a card in the converter shows the offset that applied on the date
you chose.

### Why does a card say Daylight saving time in January?

Because it is summer in the southern half of the world. Sydney reads UTC+11:00 and Daylight saving
time in January, and UTC+10:00 and Standard time in July.

### Can I share the times with other people?

Press Copy times. Every card goes to the clipboard as one line, with the name, the date, the time
and the offset. Some browsers do not let a page write to the clipboard at all.

### Why is a zone named after a city I did not choose?

A zone covers everywhere that has kept the same clock, named after one well-known place inside it.
San Francisco and Seattle both sit in `America/Los_Angeles`. Add a city by name and its card keeps
that name.

### Are my cities saved, and does this work offline?

The cities stay while the browser tab is open, and go when it closes. The tool works with no
internet connection, because the zone rules are already in the browser. There is no account, and
nothing is sent to a server.

## Good to know

The IANA time-zone database holds one zone for each region whose clocks have agreed since 1970. A
zone is named `Area/Location`, and the location is usually a large city rather than a country,
because a country can split, be renamed or change its offset, while a city stays put.

UTC and GMT are not the same thing. GMT is a time zone, and the United Kingdom keeps it in winter.
UTC is the standard the world's clocks are set from, kept by atomic clocks and held close to the
Earth's rotation. The badge reads UTC for zero, which is why London reads UTC in January.

Moving clocks forward in summer spread across Europe in 1916, to save fuel for lighting in wartime.
Many countries have since dropped it, and India keeps one offset all year. For the sunrise and
sunset behind it, use [Weather](/weather).
