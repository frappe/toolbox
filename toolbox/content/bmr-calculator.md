## How it works

Basal metabolic rate is the energy a body uses at rest, before any movement is added to it. The
calculator estimates it with the Mifflin-St Jeor equation, published in 1990, and it uses no other
equation.

The equation takes weight in kilograms, height in centimeters and age in years, and ends with a
constant:

`BMR = 10 * weight + 6.25 * height - 5 * age + 5`

The constant is `+ 5` for male and `- 161` for female. Everything before it is the same.

1. Choose metric or imperial units.
2. Enter your height and your weight.
3. Enter your age in years.
4. Choose the sex used by the formula.
5. Read the estimate in kilocalories per day, rounded to a whole number.

The field is labeled "Sex used by formula" because it selects which constant the equation ends
with. Age must be between 18 and 120, and an age below 18 is refused with a message, because the
equation was fitted on adults. Imperial entries are converted first, so 68.8976 in and 154.3236 lb
give the same estimate as 175 cm and 70 kg.

## Worked examples

### A man of 30, 175 cm and 70 kg

The estimate is **1,649 kcal/day**.

The same three measurements with female selected give 1,483 kcal/day. The gap of 166 is the
distance between the two constants, and it is the only difference the choice makes.

### A woman of 45, 165 cm and 62 kg

The estimate is **1,265 kcal/day**. With male selected, the same measurements give 1,431.

## Frequently asked questions

### How much does age change the estimate?

Five kilocalories a year, in a straight line. The man in the first example is estimated at 1,649 at
30, 1,549 at 50 and 1,449 at 70. Nothing else in the equation changes with age.

### How much does weight or height change it?

Ten kilocalories for each kilogram, and 6.25 for each centimeter. Take the first example to 80 kg
and the estimate is 1,749. Take it to 185 cm instead and it is 1,711. A kilogram moves the result
1.6 times as far as a centimeter.

### Is this how many calories I burn in a day?

No. It is the resting figure alone, with no walking, no work and no exercise in it. For a whole day
at a stated activity level, use the [TDEE Calculator](/tdee-calculator), which multiplies this same
estimate by a factor you choose.

### How accurate is it?

It is an estimate from a population equation, and one person can sit well away from the line. The
equation knows four numbers about you. It does not know your body composition, your thyroid, your
medication or your temperature, and none of those reach the result. A measured resting rate, taken
in a laboratory, can differ. Ask a doctor if you have a health question behind this one.

### Why do male and female give different results?

The two constants come from the way the original study fitted the equation to its measurements. For
identical height, weight and age the male result is 166 kilocalories higher, every time. The
equation offers those two options and no others.

### Is anything I type stored?

No. There is no account and no server call. Nothing you type leaves the browser, nothing is saved,
and every field returns to its default when you reload the page. The tool also works with no
internet connection after your first visit.

## Good to know

A basal rate is a rate, so it is stated per day. It is not a budget and it is not a target. It is
the energy cost of staying alive and still for 24 hours.

Other equations estimate the same figure and are still in wide use, so a resting rate you find
elsewhere may not match this one. This tool implements Mifflin-St Jeor only, and the result names
the equation it used, so the two are never confused.

For the height and weight ratio rather than the energy figure, use the
[BMI Calculator](/bmi-calculator). To convert pounds or stones before you start, use the
[Weight Converter](/weight-converter).
