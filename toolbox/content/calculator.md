## How it works

The calculator reads a whole expression, not one key at a time. It splits the text into numbers,
operators, function names and parentheses, builds the expression as a tree, and then works the tree
out. This is why `2 + 3 * 4` gives 14 and `(2 + 3) * 4` gives 20. The order the keys were pressed
in makes no difference to the answer.

The order of operations is the usual one. Parentheses come first, then functions such as `sqrt` and
`sin`, then a power written with `^`, then multiplication and division, then addition and
subtraction.

1. Type the expression, or press the keys.
2. Press Enter, or the equals key, to work it out.
3. Read the result under the expression.
4. Select a line in the history to put an earlier expression back.

`sqrt`, `log`, `ln`, `sin`, `cos`, `tan`, `asin`, `acos` and `atan` are all available, and `pi` and
`e` name their constants. `log` is the base-10 logarithm and `ln` is the natural one. The
trigonometric functions read degrees until you set the angle mode to radians.

The whole calculation happens in your browser. The expression never reaches a server.

## Worked examples

### A restaurant bill of 1,240 with an 18 percent tip, split four ways

Write `(1240 + 1240 * 18%) / 4`. The result is **365.8**.

The percent sign divides the number in front of it by 100, so `18%` is 0.18. The parentheses add
the tip to the bill before the division, because division would otherwise run first.

### The area of a circle with a radius of 4.5

Write `pi * 4.5 ^ 2`. The result is **63.6172512352**.

The power runs before the multiplication, so the radius is squared first. No parentheses are
needed around `4.5 ^ 2`.

## Frequently asked questions

### Does `100 + 10%` add ten percent?

No. It gives 100.1. The percent sign turns the number in front of it into a fraction, so `10%` is
0.1 and the calculator adds 0.1 to 100. To add ten percent, write `100 * 110%`, which gives 110.
Many pocket calculators read the same keys as "add ten percent of the first number". This one does
not guess what the percent belongs to.

### Do the calculations happen on my device?

Yes. The calculator is written in JavaScript and runs in the browser. Nothing you type is sent
anywhere, there is no account, and nothing is kept after the browser tab closes.

### Does it work without an internet connection?

Yes. The application is stored in the browser after your first visit, so the calculator opens and
works offline.

### Do the trigonometric functions use degrees or radians?

Degrees, until you change the angle mode. `sin(30)` gives 0.5 in degree mode. In radian mode the
same expression gives about −0.988, because 30 radians is nearly five full turns.

### How exact is the result?

A result is rounded to 12 significant digits. A number above 1e12, or below 1e-9, is shown in
scientific notation instead.

The rounding also hides an old surprise. A computer holds a decimal fraction in binary, and `0.1 +
0.2` is 0.30000000000000004 in that form. Rounding at 12 digits shows the 0.3 you expected.

### Is my history saved?

The last 10 results stay while the browser tab is open, and go when it closes. They are held in
the tab itself and never sent to a server.

## Good to know

A JavaScript number carries about 15 to 17 significant decimal digits. The calculator shows 12 of
them, which leaves the last few, where binary rounding shows up, out of sight.

The percent sign grew out of the Italian "per cento", written short by clerks until the letters
turned into the symbol.

For a loan instalment and its full repayment schedule, use the
[EMI Calculator](/emi-calculator). For a rate of growth between two amounts, use the
[CAGR Calculator](/cagr-calculator).
