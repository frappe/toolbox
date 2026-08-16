## How it works

Fuel economy is written in two opposite ways, and this converter handles both.

**Liters per 100 kilometers** counts fuel for a fixed distance, so a smaller number is a thriftier
car. **Miles per gallon** and **kilometers per liter** count distance for a fixed amount of fuel, so
a larger number is the thriftier one. The two kinds are inverses of each other, which is why the
converter divides where the other converters multiply.

Liters per 100 kilometers is the base unit. Every other unit converts through one division, and the
same division works in both directions.

Kilometers per liter uses `100 / value`. Miles per US gallon uses `235.2145833333333 / value`.
Miles per Imperial gallon uses `282.4809363318222 / value`.

1. Choose the unit your figure is written in.
2. Type the figure.
3. Choose the unit you want.
4. Read the answer in the other box.

Four units are offered: liter per 100 kilometers, kilometer per liter, mile per US gallon and mile
per Imperial gallon. Both gallons are named on the list, because they are different volumes and give
different answers. A result is shown to 12 significant digits, and the arithmetic runs in your
browser.

## Worked examples

### 30 miles per gallon in liters per 100 kilometers

30 mpg (US) is **7.84048611111 L/100 km**.

Read the same 30 as Imperial mpg and it describes a different car. 30 mpg (Imp) is 24.9802255389
mpg (US), because an Imperial gallon holds more fuel than a US one.

### 7 liters per 100 kilometers in miles per gallon

7 L/100 km is **33.6020833333 mpg (US)**, 40.354419476 mpg (Imp) and 14.2857142857 km/L.

Note the direction. Against the first example the liters figure fell from 7.84048611111 to 7, and
the mpg figure rose from 30 to 33.6020833333. Whatever lowers one raises the other.

## Frequently asked questions

### How do I convert miles per gallon to liters per 100 km?

Divide 235.2145833333333 by the mpg figure. 25 mpg is 9.40858333333 L/100 km, 30 mpg is
7.84048611111, 40 mpg is 5.88036458333, and 50 mpg is 4.70429166667.

The same division runs the other way, because the two units are inverses. 8 L/100 km is
29.4018229167 mpg (US), 6 L/100 km is 39.2024305556 mpg, and 10 L/100 km is 23.5214583333 mpg.

### Why does a higher number mean a better car in one unit and a worse car in the other?

Because the two units measure opposite things. Liters per 100 kilometers asks how much fuel a fixed
trip costs, so less is better. Miles per gallon asks how far a fixed amount of fuel goes, so more is
better. A car at 4 L/100 km is 58.8036458333 mpg (US), and a car at 12 L/100 km is 19.6012152778
mpg (US).

### Which gallon does the converter use?

Both, under separate names, so nothing is assumed for you. The US gallon is 3.785411784 liters and
the Imperial gallon is 4.54609 liters, and the Imperial figure is always the larger one for the same
car. 30 mpg (US) is 36.0284977651 mpg (Imp), and one mile per US gallon is 1.2009499255 mpg (Imp).

For the volumes on their own, use the [Volume Converter](/volume-converter).

### How do I convert kilometers per liter?

Divide 100 by the figure to reach liters per 100 kilometers. 20 km/L is 5 L/100 km and
47.0429166667 mpg (US). 15 km/L is 6.66666666667 L/100 km and 35.2821875 mpg (US). One kilometer per
liter is 2.35214583333 mpg (US).

### What happens if I enter 0?

The converter reports that the conversion is undefined for the value supplied. A car that uses no
fuel travels an unbounded distance on a gallon, so the division has no answer. Negative numbers
convert, but they describe nothing real.

### Does the converter work offline, and is anything I type stored?

Yes to the first, and no to the second. The application is kept in the browser after your first
visit, so the page opens and converts with no connection. There is no account, nothing you type
reaches a server, and no result is written down.

## Good to know

The constant 235.2145833333333 is not arbitrary. It is the liters in a US gallon divided by the
kilometers in a mile, scaled to 100 kilometers, and 282.4809363318222 is the same sum with the
Imperial gallon.

Because the conversion divides in both directions, converting a figure and converting it back
returns the number you started with.

The two styles also average differently. Over two legs of equal distance, the liters per 100
kilometers of each leg can be averaged directly, because they add up along the route. Averaging the
miles per gallon of each leg overstates the car, and the true figure is always the lower one.
