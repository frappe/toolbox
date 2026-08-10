## How it works

CAGR is the compound annual growth rate. It is the single constant rate that would take the
starting value to the ending value over the duration you enter. It is one rate, not an average.

`CAGR = ((ending value / starting value)^(1 / years) - 1) * 100`

The ratio of the two values is raised to the power of one divided by the number of years, which
undoes the compounding. Subtracting 1 turns the growth factor into a rate, and 100 turns it into a
percentage.

1. Enter the starting value.
2. Enter the ending value.
3. Enter the duration in years.
4. Read the growth rate and the absolute change.

The absolute change is plain subtraction: the ending value minus the starting value. It is not
compounded and it does not depend on the duration.

Both values must be greater than zero. A starting value of zero has no growth rate, because the
formula divides by it. A negative value makes the ratio negative, which has no real root. The
duration can be a fraction of a year.

Amounts follow the currency and the number format you choose in settings. The calculation runs in
your browser.

## Worked examples

### 100,000 grows to 200,000 over 5 years

The compound annual growth rate is **14.87 percent** and the absolute change is 100,000.00.

The same doubling over a different term gives a different rate. Over 7 years it is 10.41 percent,
and over 10 years it is 7.18 percent. The amount gained is 100,000.00 in all three cases, which is
why the absolute change alone tells you little.

### 250,000 falls to 180,000 over 3 years

The growth rate is **−10.37 percent** and the absolute change is −70,000.00. A fall gives a
negative rate, and the formula needs no separate mode.

## Frequently asked questions

### Why does CAGR not match the average of the yearly changes?

Because gains and losses compound. Take 100,000 that rises by half in one year and then loses half
in the next. It ends at 75,000, and the calculator reports −13.40 percent over 2 years. The two
yearly changes average to zero, but the money did not stay level. A loss removes more than the same
percentage gain puts back, because the loss applies to a larger balance.

### Does CAGR describe what happened in between?

No. It reads two numbers and a duration. A value that climbed steadily and one that crashed and
recovered give the same CAGR if they start and end at the same place on the same date. Nothing
about the path survives the calculation.

### Can the duration be a fraction of a year?

Yes. 850,000 to 1,420,000 over 6 years is 8.93 percent. The same change over half a year is 179.09
percent, because the calculator states the rate a full year at that pace would give.

### How do I turn a growth rate back into an amount?

Use the [Future Value Calculator](/future-value-calculator). 100,000 at 12 percent for 5 years gives
176,234.17, and feeding 100,000 and 176,234.17 back into this page over 5 years returns 12.00
percent.

### Why does it refuse a starting or ending value of zero?

The starting value is the divisor, so zero has no answer. The ratio is raised to a fractional
power, and a zero or negative ratio has no real result. The calculator says
`Starting value must be greater than zero.` or `Ending value must be greater than zero.` and stops.

### Is anything I type stored?

No. There is no account and nothing you type is sent to a server. The last 10 results stay while
the browser tab is open and go when it closes. The page works with no internet connection.

## Good to know

CAGR answers one question. At what steady pace would the starting value have to grow to reach the
ending value.

The rate is shown to the decimal precision set in settings, so it is a rounded figure. Enter 14.87
percent into the [Future Value Calculator](/future-value-calculator) for 5 years and 100,000 becomes
200,001.43 rather than exactly 200,000. The extra 1.43 is the rounding, not an error.

For a growth rate applied to a monthly plan instead of a single amount, use the
[SIP Calculator](/sip-calculator).
