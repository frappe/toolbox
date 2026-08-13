## How it works

The countdown counts down to a moment. You give it that moment in one of two ways. A duration adds
the minutes you enter to the current clock reading. A date and time is read as a wall-clock time in
your device's own time zone, and turned into the moment it stands for.

Either way one moment is stored, and the display is one subtraction:

`remaining = target moment - current time`

The page reads the clock four times a second to refresh the display. No running total is kept, so a
slow refresh, a reload or a suspended tab cannot make the countdown drift. It shows the time that
has really passed, not the time the page was on screen for.

1. Choose Duration, or Date and time.
2. Enter the minutes, or pick the date and the time.
3. Press Start countdown.
4. Read the target under the buttons, written in your own date and time format.
5. Press Clear to remove it.

A target that is not in the future is refused, with the message "Choose a future date or a duration
of at least one minute."

The display counts hours, minutes and seconds. It has no field for days, so a long countdown is
shown as a large number of hours.

## Worked examples

### A countdown of 90 minutes

Enter 90 minutes and press Start countdown. The display reads **01:30:00**, and the target line
below the buttons shows the date and the clock time 90 minutes ahead.

Switch to another tab and come back after 70 minutes. The display reads **00:20:00**. A background
tab is refreshed less often, and none of that matters, because the remaining time is worked out from
the clock.

### A countdown to a date 144 days away

Pick a date and time 144 days ahead and press Start countdown. The display reads **3456:00:00**,
because 144 days is 3456 hours. It does not read 144 days. To read the display in days, divide the
hours by 24.

## Frequently asked questions

### Does the countdown make a sound when it reaches zero?

No. It shows 00:00:00 and the status reads Done, and nothing plays. Only the [Timer](/timer) sounds
a tone, and it does so once, when its own duration runs out. Use the timer if you need to be told
rather than to look.

### Why is a long countdown shown in hours rather than days?

The display has three fields: hours, minutes and seconds. The hours field is not capped at 24, so a
target a year away reads 8760:00:00. Nothing is lost, and the seconds stay readable, which is what
a countdown is usually watched for at the end.

### Which time zone is the target date read in?

Your device's own. The date and time you pick is treated as the clock time where you are, and the
browser turns it into a moment using your zone's rules. To count down to a time given in another
country, work out what that time is where you are with the
[Time Zone Converter](/time-zone-converter), then enter that.

### How far ahead can the target be?

The duration field takes up to 525600 minutes, which is 365 days. The date field takes any date and
time in the future.

### What happens if I reload the page or close the tab?

A reload picks the countdown up where it stands, because the target is a fixed moment rather than a
number counting down: the page subtracts the current time from it and shows the correct figure.
Nothing runs while the tab is closed, and nothing needs to.

Closing the tab clears the target. It is held for the browser session only, like everything else
Toolbox keeps. Enter the date again and the countdown reads the same, because the moment did not
move.

### Is anything I enter sent to a server?

No. The target stays in your browser. There is no account, and the countdown works with no internet
connection once the application is stored after your first visit.

## Good to know

Because the target is a moment rather than a count of hours, a daylight-saving change between now
and then is handled for you. Pick 09:00 on a date on the other side of a clock change in your zone,
and the countdown still ends at 09:00 on that date. The browser worked the moment out from your
zone's own rules, and the hours in between are simply one hour more or one hour fewer.

The countdown reads the clock that reports the date and time, not a counter that only goes forward.
That is the right clock for this job. The answer to "how long until Friday at 09:00" depends on
today's date, so a wrong device clock gives a wrong countdown.
