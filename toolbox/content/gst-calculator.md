## How it works

The calculator adds GST to an amount that does not include it, and takes GST back out of an amount
that already does.

Adding is one multiplication:

`GST = amount * rate / 100`

Removing is a division, because the rate applies to the value before tax:

`taxable value = inclusive amount * 100 / (100 + rate)`

The GST inside the bill is then the inclusive amount minus the taxable value.

1. Choose Add GST or Remove GST.
2. Enter the amount.
3. Choose intra-state or inter-state as the place of supply.
4. Choose a rate, or type your own.
5. Read the taxable value, the tax split and the final amount.

**You choose the rate.** The buttons offer 0, 0.25, 3, 5, 12, 18 and 28 percent, and the custom box
takes any rate from 0 to 100 with up to four decimal places. The calculator applies the rate you
pick. It does not decide which rate a good or a service carries. Rates are set by notification and
carry effective dates, so confirm the rate against an official source.

The place of supply decides the split. An intra-state supply divides the total into CGST and SGST,
half each. An inter-state supply reports the whole total as IGST.

The arithmetic runs in whole paise as integers and rounds a half up. Amounts appear in rupees to two
decimal places, and the whole calculation happens in your browser.

## Worked examples

### 18 percent GST added to 45,000 inside one state

The total GST is **8,100.00** and the final amount is **53,100.00**. The split is 4,050.00 of CGST
and 4,050.00 of SGST.

The same sale to another state carries the same 8,100.00 as IGST. The place of supply moves tax
between components. It does not change what the buyer pays.

### GST removed from a 12,500 bill at 12 percent

The taxable value is **11,160.71** and the GST already inside the bill is **1,339.29**. Inside one
state that is 669.64 of CGST and 669.65 of SGST. Between two states it is 1,339.29 of IGST.

Adding 12 percent back to 11,160.71 returns the 12,500.00 the bill started at.

## Frequently asked questions

### How do I find the GST inside a price that already includes it?

Choose Remove GST and enter the price. An amount of 1,000 at 18 percent holds 847.46 of taxable
value and 152.54 of tax.

Removing a rate is not the same as subtracting it. An 11,800 amount at 18 percent leaves 10,000.00
of taxable value, because the divisor is 118 and not 100.

### When is the tax CGST and SGST, and when is it IGST?

That follows the place of supply, and the two buttons set it. The calculator reads no address and
infers nothing from one.

### Why is CGST 24.97 and SGST 24.98 on the same bill?

Because half of the total is not a whole paisa. An amount of 999 at 5 percent carries 49.95 of tax,
and half of that is 24.975. CGST takes the lower half and SGST takes the extra paisa, so the two
still add up to 49.95.

### Which rate applies to what I sell?

The calculator does not know, and does not guess. Find the code for a good or a service with
[HSN & SAC Lookup](/hsn-sac-lookup), then confirm the rate that code carries against an official
source.

### Can I use a rate that is not on a button?

Yes. Choose Custom and type it. A 2,500 amount at 7.5 percent carries 187.50 of tax and comes to
2,687.50. A rate of 0 is allowed as well.

### Is anything I type stored?

No. The calculation runs in your browser, there is no account, and nothing reaches a server. The
last 10 results stay while the tab is open and go when it closes. The application is stored in the
browser after a first visit, so this calculator works offline as well.

## Good to know

The parts stay consistent at every rate. CGST plus SGST plus IGST equals the total GST, and the
taxable value plus the total GST equals the final amount.

Counting in whole paise is what holds that together. A decimal fraction kept in binary drifts over a
chain of multiplications. Integers do not.

For arithmetic the tax split does not cover, use the [Calculator](/calculator).
