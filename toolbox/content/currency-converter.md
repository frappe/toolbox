## How it works

This converter is the one tool here that needs a network. It reads the euro foreign exchange
reference rates published by the **European Central Bank**. The server fetches the ECB daily rate
file, keeps a copy of it, and hands the page a table of rates carrying the date the ECB put on them.

Every rate in that table is quoted against the euro, so a conversion between two other currencies is
a cross rate. The amount is divided by the rate of the currency you hold and multiplied by the rate
of the currency you want, or `converted = amount / rate_from * rate_to`.

1. Type an amount, and choose the two currencies.
2. Read the converted amount in the other box.
3. Check the rate date printed under the tool.
4. Open the chart to see how the pair has moved.

Both boxes accept a value, so the conversion runs in either direction. The line under the tool gives
the rate date, the state of the figures, and when the server last checked the ECB. Beside it sits
the notice that comes with the data: ECB reference rates are for information only, and are not
transaction rates.

## Worked examples

### 500 US dollars in Indian rupees

Take a day on which the table says 1 EUR = 1.10 USD and 1 EUR = 99.00 INR. Both are example figures,
chosen to keep the arithmetic clear. A rate moves every day, so read the rate date on the page for
the figures in use now.

Neither currency is the euro, so the tool works through it. 500 dollars is `500 / 1.10` euros, and
those euros are multiplied by 99.00, which gives **45,000 INR**. The dollar to rupee rate these two
published figures imply is 90.00, and the ECB never quotes it.

## Frequently asked questions

### Where do the exchange rates come from?

From the European Central Bank. The page names the source, prints the date on the rates, and links
to the ECB page they came from. They are a daily snapshot rather than a dealing rate, so a bank or a
card will give you something else.

### How often do the rates refresh?

The server checks the ECB file when a visitor asks and its copy is more than six hours old, so the
file is read at most four times a day, and only when it has changed.

The status word under the tool says which case you are in: updated for a table just read from the
ECB, server cache for the copy the server already held, and stale server cache when the ECB could
not be reached and an older copy is standing in.

### Does the currency converter work offline?

Not the way the other converters do. The last table this browser received is saved on your device,
and the tool converts offline only if there is one.

The page then opens and converts from that saved table, the status reads offline snapshot, and a
notice says the latest rates could not be checked. A browser that has never held a table converts
nothing and asks you to connect. The chart needs the network every time.

### Which currencies can I convert?

The 30 that the ECB table carries and the tool has a name for: AUD, BRL, CAD, CHF, CNY, CZK, DKK,
EUR, GBP, HKD, HUF, IDR, ILS, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB,
TRY, USD and ZAR. Any pair works, in either direction.

### Where does the rate chart history come from?

From the ECB statistical data service. The server asks it for the daily series of each of the two
currencies against the euro, then works out the cross rate for every date both were published on.
Nothing is estimated.

The ranges are one month, six months, one year, five years and Max, which reaches back to 4 January
1999, the first day of the series. A long range is thinned to 500 points, keeping the first and the
last, and Download CSV writes those points to a file.

### Is my amount sent to a server?

No. The request asks for the rate table alone, with no amount and no currency in it, and the
conversion runs in your browser. The chart request does name the two currencies, because the server
has to ask for that series. There is no account, and nothing you convert leaves this browser.

## Good to know

The euro sits at the center of every figure here, so a small difference from a quote you saw
elsewhere often comes from the cross-rate step alone.

For a conversion that never needs a network, use the [Length Converter](/length-converter) or the
[Data Storage Converter](/data-storage-converter).
