## How it works

An EMI is an equated monthly instalment. It is the same amount every month until the loan is
repaid. What changes each month is the split inside it, between interest and repayment.

The instalment comes from one formula:

`EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)`

**P** is the amount borrowed. **r** is the interest rate for one month, which is the annual rate
divided by 12 and then by 100. **n** is the number of monthly payments, which is the duration in
years multiplied by 12.

1. Enter the amount you borrow.
2. Enter the annual interest rate.
3. Enter the duration in years.
4. Read the instalment, the total interest and the repayment schedule below it.

The schedule is built month by month. The interest for a month is the balance at the start of that
month multiplied by the monthly rate. Whatever is left of the instalment reduces the balance. The
balance falls slowly at first, so an early instalment is mostly interest and a late one is mostly
repayment.

A rate of zero is allowed. The instalment is then the amount borrowed divided by the number of
payments.

Amounts follow the currency and the number format you choose in settings. The calculation itself
runs in your browser.

## Worked examples

### 2,000,000 borrowed for 20 years at 9 percent

The monthly rate is 0.75 percent and there are 240 payments. The instalment is **17,994.52**.

The first instalment is 15,000.00 of interest and 2,994.52 of repayment. Over the whole loan you
pay 4,318,684.59, and 2,318,684.59 of that is interest. The interest is larger than the amount
borrowed.

### 800,000 borrowed for 5 years at 11 percent

The instalment is **17,393.94**. The first one is 7,333.33 of interest and 10,060.61 of
repayment, and the interest over the whole loan is 243,636.31.

The rate is higher than in the first example, and the interest is a small fraction of it. A short
loan repays the balance quickly, and interest is only ever charged on the balance.

## Frequently asked questions

### Why is an early instalment almost all interest?

Interest is charged on what you still owe, and at the start you owe nearly everything. In the
first example the balance is 2,000,000 in month one, so the interest for that month alone is
15,000.00. Only 2,994.52 of the instalment is left to reduce the balance. As the balance falls the
interest falls with it, and more of the same instalment goes to repayment.

### Does a longer loan cost more?

Yes, and the difference is large. The same 2,000,000 at 9 percent costs 20,285.33 a month over 15
years, 17,994.52 over 20 years, and 16,783.93 over 25 years. The interest over those three loans is
1,651,359.70, then 2,318,684.59, then 3,035,178.18. Ten more years takes about 3,500 off the
monthly instalment and adds about 1,383,818 to the interest.

### What does half a percent of interest cost?

On the same loan over 20 years, a rate of 9.5 percent instead of 9 percent raises the instalment
from 17,994.52 to 18,642.62. The interest rises from 2,318,684.59 to 2,474,229.70, which is
155,545.11 more.

### Does the calculator include fees, insurance or taxes?

No. It works out the instalment on the amount, the rate and the duration you enter. A lender may
add a processing fee, insurance or a tax, and may charge them separately from the instalment. Ask
the lender for the total cost of the loan, not only the rate.

### What if my interest rate changes?

The calculation assumes one fixed rate for the whole loan. For a loan whose rate moves, enter the
balance you still owe as the amount, the new rate, and the years left. The instalment you get is
the one that clears that balance in that time.

### Is anything I type stored?

No. The whole calculation runs in your browser. There is no account, nothing is sent to a server,
and nothing is kept after the browser tab closes.

## Good to know

Prepayment works on the balance, not on the instalment. Any amount paid on top of an instalment
reduces the balance the next month, and every month after it is charged interest on the smaller
balance.

The formula is a geometric series in disguise. It states that the payments, each discounted back to
the day the loan starts, add up to the amount borrowed.

To see the same arithmetic from the other side, where the balance grows instead of falling, use the
[Compound Interest Calculator](/compound-interest-calculator) or the
[SIP Calculator](/sip-calculator).
