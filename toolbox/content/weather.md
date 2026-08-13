## How it works

The forecast comes from MET Norway, the Norwegian Meteorological Institute. Its Locationforecast 2.0
service gives the temperature, wind, humidity and precipitation. Its Sunrise 3.0 service gives the
sunrise and the sunset.

A forecast needs a coordinate rather than a name, so the search resolves one first. It reads a copy
of the GeoNames `cities15000` release that ships inside the application. That release holds 34,080
settlements of more than 15,000 people, with the region, country, time zone and population of each.

1. Type at least two letters of a city name.
2. Select the city you meant from the results.
3. Read the current conditions, the next 24 hours and the next seven days.

A city also answers to the names it is known by locally. The dataset carries 23,992 of those names,
so **München** finds Munich and **Bombay** finds Mumbai. Marks above and below a letter are folded
away before the match, so `Zurich` finds Zürich and `Tromso` finds Tromsø.

Names that begin with what you typed come first, most populous first. Only when none does will the
search look inside a name, which is how `vegas` reaches Las Vegas.

Every time on the page is the local clock of the place you searched for, not your own.

## Worked examples

### Typing München to find Munich

The search folds the name to `munchen`. No city is named that, but Munich carries `munchen` and
`muenchen` among its local names, so Munich in Bavaria, Germany is the one result. Its recorded
population is 1,505,005 and its time zone is `Europe/Berlin`.

### Five places named Springfield

A name on its own does not identify a place. `Springfield` returns five cities in the United States,
most populous first: Missouri with 170,188 people, Massachusetts with 154,341, Illinois with
114,394, Oregon with 60,870 and Ohio with 59,680. The region under each name separates them.

## Frequently asked questions

### How far ahead does the forecast reach?

The page shows the next 24 hours hour by hour, and then seven days. Each day carries a high, a low
and one condition.

### Why does the forecast stay the same when I refresh it?

The server keeps one copy of each forecast and treats it as current for 20 minutes. A refresh inside
that time reads the copy. The copy is held for six hours, so when MET cannot be reached the page
falls back to it and labels it a stale server cache.

### Why does my city show no chance of rain?

MET models the probability of precipitation for the Nordic area only. Everywhere else the field is
absent, and the page leaves the line out rather than print a number nobody computed.

### Does it work without an internet connection?

Partly. The application is stored in your browser after your first visit, so the page opens. It
shows the last forecast it saved, labeled as an offline copy, for as long as the browser session
lasts. Close the browser and that copy is gone, so a later visit with no connection opens the page
and no forecast. A new search and a new forecast need a connection.

### Is my search kept anywhere?

No. The name reaches the Toolbox server, which matches it against the bundled city data and answers.
Nothing is written down and there is no account. The coordinate reaches MET rounded to four decimal
places, with nothing that identifies you.

The offline copy is the one thing kept in your browser, and it names the place it is for. It is
kept for the browser session and no longer, for that reason.

### Why do some days show no sunrise?

Above the Arctic circle and below the Antarctic circle the sun does not rise or set on some dates.
MET reports no time, and the page drops the line.

## Good to know

A forecast is a probability, not a promise. A weather model starts from a measured picture of the
atmosphere that is never exact, and small errors in that picture grow as the model steps forward.
This is why tomorrow is forecast better than next week.

MET publishes no "feels like" reading, so Toolbox computes one with Steadman's apparent temperature.
It raises the air temperature for humidity, which slows the loss of heat by sweating, and lowers it
for wind, which carries heat away.

Every temperature here is Celsius until you choose otherwise. Settings holds the choice, and
Fahrenheit is applied as the page is drawn, so the forecast itself is fetched once whichever unit
you read in.

MET Norway and GeoNames both license their data CC BY 4.0. For the time in another city, use the
[World Clock](/world-clock). To convert a temperature that did not come from a forecast, use the
[Temperature Converter](/temperature-converter).
