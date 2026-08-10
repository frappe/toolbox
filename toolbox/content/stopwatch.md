## How it works

The stopwatch measures elapsed time from two stored numbers. One is the time collected by earlier
runs. The other is the moment the current run started. Elapsed time is:

`elapsed = collected time + (current time - moment this run started)`

Stop moves the running part into the collected total and forgets the start moment. Start records a
new start moment. Nothing is counted up, so a stop and a start of any length loses nothing, and a
browser that refreshes the page slowly cannot make the reading drift.

1. Press Start.
2. Press Lap to mark a split without stopping the clock.
3. Press Stop to hold the reading, and Start to carry on.
4. Press Reset to return to zero and clear the laps.

A lap stores two numbers. One is the total elapsed time at the moment you pressed Lap. The other is
the split, which is that total less the total at the previous lap. The first lap has no previous
lap, so its split equals its total. The list shows the newest lap first, with the split and then the
total beside it.

The reading is shown to a hundredth of a second, and the page refreshes it four times a second, so
the last two digits step rather than run. Each reading is correct for the instant it was taken.

Up to 1000 laps are kept. Lap only works while the stopwatch is running.

## Worked examples

### Three laps of about one minute each

Press Lap at 1 minute 5.43 seconds, again at 2 minutes 8.90 seconds, and again at 3 minutes 11.01
seconds. The list reads **00:01:02.11 · 00:03:11.01** for lap 3, **00:01:03.47 · 00:02:08.90** for
lap 2, and **00:01:05.43 · 00:01:05.43** for lap 1.

The right-hand number is the total since you started, and it only ever grows. The left-hand number
is the lap on its own, and here it falls each time. The three splits add up to the last total.

### A stopwatch stopped and started again

Run the stopwatch to 00:02:08.90 and press Stop. That reading becomes the collected total. Leave the
page for ten minutes, then press Start. Thirty seconds later the display reads **00:02:38.90**. The
ten minutes are not in the total, because the clock was not running through them.

## Frequently asked questions

### Does the stopwatch keep running if I switch tabs?

Yes. The stopwatch holds the moment the run started, and every refresh subtracts it from the current
time. A background tab is refreshed less often, so the display changes less often, but the number is
correct each time it is worked out. The same holds for a phone with the screen off.

### What is the difference between a lap and a split here?

The split is the time for that lap on its own. The total beside it is the time since you first
started. Timing conventions differ between sports and between stopwatches, so read the two numbers
rather than the two names. In the list the split is on the left and the total is on the right.

### How many laps can I record?

Up to 1000. After that the Lap button stops adding rows and the stopwatch keeps running. Reset
clears every lap along with the reading.

### Does the stopwatch make a sound?

No. It has no alarm and no notification. Only the [Timer](/timer) plays a tone, and it plays it when
the time it counts down runs out.

### Can I save or download my lap times?

No. There is no download and no copy button. The laps are plain text on the page, so you can select
them and copy them yourself. They are held in this browser and never sent anywhere.

### Does it work without an internet connection?

Yes. The application is stored in the browser after your first visit, so the stopwatch opens and
runs offline. There is no account and nothing to sign in to.

## Good to know

The elapsed time is held in milliseconds and shown to a hundredth of a second. The display rounds
down rather than to the nearest value, so a reading of 1.999 seconds shows as 00:00:01.99.

The reading is taken when your press reaches the page, and a press travels through the browser
before it gets there. Treat the hundredths as a guide to a lap, not as a result for a race that is
decided on them.

The stopwatch, the [Timer](/timer) and the [Countdown Timer](/countdown-timer) share one workspace,
so a stopwatch keeps running while you set a timer on another page.
