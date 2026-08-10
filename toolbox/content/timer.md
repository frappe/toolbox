## How it works

The timer counts down from a number of minutes. It does not add up ticks. When you press Start it
records the moment the timer is due, which is the clock reading at that instant plus the duration.
What the display shows is one subtraction:

`remaining = due moment - current time`

The page reads the clock four times a second to refresh the display, and that reading is all the
refresh does. No running total is kept, so a late or a missed refresh cannot make the timer drift.

1. Enter a duration in minutes, from 1 to 1440.
2. Enter a label if you want the display to name what the timer is for.
3. Press Set timer, then press Start.
4. Press Pause to hold it, and Start again to carry on from where it stopped.

Pause stores the time that is left rather than the moment the timer was due. Starting again sets a
new due moment from the time that is left, so a pause of any length costs you nothing.

The display shows hours, minutes and seconds, and it rounds down. A 25 minute timer reads 00:24:59 a
fraction of a second after it starts.

The timer, the [stopwatch](/stopwatch) and the [countdown timer](/countdown-timer) share one
workspace. A timer keeps running while you use the other two.

## Worked examples

### A 25 minute timer paused after 5 minutes

Set 25 minutes and press Start. Five minutes later the display reads **00:20:00**. Press Pause and
the timer holds 00:20:00, whether you come back after one minute or after one hour.

Press Start again and a new due moment is set 20 minutes ahead of that instant. The timer ends 20
minutes after you resumed it, not 25.

### A 90 minute timer left in a background tab

Set 90 minutes and switch to another tab. A browser slows a background tab down, and may refresh it
once a second or less often. The timer loses none of that, because it works out what is left from
the clock. Come back after 70 minutes and the display reads **00:20:00**.

## Frequently asked questions

### Does the timer keep counting if I switch tabs?

Yes. The timer holds the moment it is due, and every refresh subtracts the current time from that
moment. A background tab is refreshed less often, so the number on screen changes less often, but it
is correct each time it is worked out. The same holds for a phone with the screen off.

### Does the timer make a sound?

Yes, one tone, once. When the remaining time reaches zero the page plays a single 880 hertz note for
one and a half seconds. The tone is not repeated, and there is no choice of sound. There is no
desktop notification and no vibration.

A browser or an operating system can suspend a background tab, and a suspended page cannot play
anything. The page says so above the timer. The display is always right when you come back. The
sound is not promised.

### What happens if I close the tab?

Nothing runs while the tab is closed, so no tone can play. The timer is written to this browser as
you use it, and what is stored is the moment it is due. Open the page again and the tool subtracts
the current time from that moment, so you see the time that has really passed. A timer whose moment
has already gone reads 00:00:00 and Done.

### How long can a timer be?

From 1 minute to 1440 minutes, which is 24 hours. For anything longer, use the
[Countdown Timer](/countdown-timer), which accepts a date instead of a duration.

### Does it work without an internet connection?

Yes. The application is stored in the browser after your first visit, so the timer opens and runs
offline.

### Is anything I set sent to a server?

No. The duration, the label and the state of the timer stay in your browser. There is no account.

## Good to know

A browser gives a page two kinds of clock. One only counts forward and never jumps. The other
reports the date and time, and can be set. This timer uses the second one, so it agrees with the
clock on your screen. If the device clock is corrected while a timer runs, by hand or by a time
server, the timer follows the correction.

The display counts hours and has no field for days, so a timer set to its longest duration reads
24:00:00 rather than one day.

For a duration in one unit stated in another, use the
[Time Unit Converter](/time-unit-converter).
