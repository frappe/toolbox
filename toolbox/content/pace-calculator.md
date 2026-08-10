## How it works

Distance, duration and pace are three views of one run. Give the calculator any two of them and it
returns the third, along with the average speed.

The three relations are the same relation, rearranged:

`pace = duration / distance`

`duration = distance * pace`

`distance = duration / pace`

1. Choose which of the three you want calculated.
2. Choose kilometers or miles.
3. Enter the other two values.
4. Read the result, the two values you gave, and the average speed.

The unit you choose applies to the whole result. In kilometers the pace is minutes per kilometer
and the speed is km/h. In miles it is minutes per mile and mi/h.

A duration and a pace are typed on a clock, as `MM:SS` or as `HH:MM:SS`. Minutes and seconds must
be below 60, and the total must be above zero. `30` on its own is refused, because the calculator
cannot tell 30 minutes from 30 seconds and does not guess. Write `30:00`.

The calculation assumes one constant pace across the whole distance, and the result says so. A
distance is shown to two decimal places, a time to the nearest second, and a speed to two decimal
places.

## Worked examples

### 10 kilometers in 52:30

The pace is **05:15 per km** and the average speed is 11.43 km/h.

The same run reads the other way round. Ask for the duration of 10 km at 05:15 per km, and the
answer is 52:30.

### A marathon at 05:45 per kilometer

Enter 42.195 km and a pace of 05:45, and ask for the duration. The result is **4:02:37**, at an
average speed of 10.43 km/h.

Thirty seconds a kilometer slower, at 06:15, the same marathon takes 4:23:43. Half a minute per
kilometer is worth about 21 minutes across the distance.

## Frequently asked questions

### What pace do I need for a sub-four-hour marathon?

Ask for the pace, enter 42.195 km and a duration of 4:00:00. The answer is **05:41 per km**, which
is an average speed of 10.55 km/h.

### How far can I run in a set time?

Ask for the distance. At 06:30 per km for 45:00 the answer is 6.92 km. At 05:00 per km for 1:00:00
it is 12.00 km.

### How do I type the time?

Use `MM:SS` for anything under an hour and `HH:MM:SS` above it. One hour and five minutes is
`1:05:00`. Minutes or seconds of 60 or more are refused, so `05:99` returns an error rather than a
result.

### Can I work in miles?

Yes. Choose miles, and the distance, the pace and the speed all follow. Five miles in 40:00 gives a
pace of 08:00 per mi and an average speed of 7.50 mi/h.

### What speed is my pace?

The result shows it. A pace of 05:00 per km is 12.00 km/h, and 05:45 per km is 10.43 km/h. Pace and
speed are the same fact inverted, since one is time over distance and the other is distance over
time. To take that speed into knots, feet per second or any other unit, use the
[Speed Converter](/speed-converter).

### Is anything I type stored?

No. There is no account and no server call. Nothing you type leaves the browser, nothing is saved,
and every field returns to its default when you reload the page. The tool also works with no
internet connection after your first visit.

## Good to know

The standard distances are longer than their round numbers. A marathon is 42.195 km and a half
marathon is 21.0975 km, and a half at 05:45 per km takes 2:01:19. Entering 42 instead of 42.195
gives 4:01:30 rather than 4:02:37, so the last 195 meters are worth 01:07 at that pace.

A pace lost early has to be paid back in full. Run the first half of that marathon 30 seconds a
kilometer slow, at 06:15, and it takes 2:11:52. The second half at 05:15, thirty seconds fast,
takes 1:50:46. The two add to 4:02:38, within a second of the even 4:02:37, and the odd second is
rounding.

To convert a distance between miles and kilometers before you start, use the
[Length Converter](/length-converter).
