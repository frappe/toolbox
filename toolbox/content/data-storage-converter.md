## How it works

The converter holds every size as **bytes**. That is the base unit of the measurement. The value you
type is multiplied by the factor of the unit it is written in, which gives bytes, and that figure is
then divided by the factor of the unit you asked for.

Two families of units share the page, and they use different factors.

The decimal units step by 1,000. A kilobyte is `1000` bytes, a megabyte is `1000000`, a gigabyte is
`1000000000`, and a terabyte is `1000000000000`. The binary units step by 1,024. A kibibyte is
`1024` bytes, a mebibyte is `1024 * 1024`, a gibibyte is `1024 * 1024 * 1024`, and a tebibyte is
1,099,511,627,776 bytes. A bit is an eighth of a byte.

1. Choose the unit you are converting from.
2. Type the size.
3. Choose the unit you want.
4. Read the answer in the other box.

Ten units are offered: bit, byte, kilobyte, megabyte, gigabyte, terabyte, kibibyte, mebibyte,
gibibyte and tebibyte. A result is shown to 12 significant digits, and a figure of 1e12 or more is
written in scientific notation, so one terabyte in bytes reads 1e+12.

## Worked examples

### A 500 GB drive that the computer reports as 465 GB

500 GB is **465.661287308 GiB**.

The drive maker counts 1,000,000,000 bytes to the gigabyte. Many operating systems divide the same
bytes by 1,073,741,824 and print the answer with a GB label, so nothing is missing. The gap grows
with size: 2 TB is 1.81898940355 TiB, and 256 GB is 238.418579102 GiB.

### A 100 MB upload limit in mebibytes

100 MB is **95.3674316406 MiB**.

One megabyte is 0.953674316406 MiB, and one mebibyte is 1.048576 MB. The gap between the two units
is small enough to ignore until a file sits close to the limit.

## Frequently asked questions

### How many MB are in a GB?

1,000 MB. One megabyte is 0.001 GB, so 500 MB is 0.5 GB and 8 GB is 8,000 MB. One terabyte is 1,000
GB and 1,000,000 MB, and 25 MB is 25,000 kB.

### Does this converter treat a kilobyte as 1,000 or 1,024 bytes?

1,000 bytes. Kilobyte, megabyte, gigabyte and terabyte all step by 1,000, which is what the SI
prefixes mean and what storage and network products are labeled with.

The 1,024 units are on the same list under their own names. A kibibyte is 1,024 bytes, which is
1.024 kB. A gibibyte is 1.073741824 GB, and a tebibyte is 1.09951162778 TB. Nothing here silently
mixes the two, so you always know which one you asked for.

### Why does my hard drive show less space than the label?

Because the label and the operating system use different units under the same name. 500 GB is
465.661287308 GiB, 1 TB is 0.909494701773 TiB, 64 GB is 59.6046447754 GiB, and 4 GB is
3.72529029846 GiB. No space disappeared, and formatting the drive does not bring it back.

### How many bits are in a byte?

8 bits. One bit is 0.125 bytes, one megabyte is 8,000,000 bits, and one gigabyte is 8,000,000,000
bits. Bits matter when a size meets a connection, because a network speed is quoted in bits per
second while a file is measured in bytes.

### Which units does this converter offer?

Bit, byte, kilobyte, megabyte, gigabyte, terabyte, kibibyte, mebibyte, gibibyte and tebibyte, and
any pair of them in either direction. One kilobyte is 1,000 bytes and one gigabyte is 1,000,000,000
bytes.

### Does the converter work offline, and is anything I type stored?

Yes to the first, and no to the second. The application is kept in the browser after your first
visit, so the page opens and converts with no connection. There is no account, nothing you type
reaches a server, and the last 10 results stay in the recent list only while the browser tab is
open.

## Good to know

Kibibyte, mebibyte, gibibyte and tebibyte are not informal names. The International Electrotechnical
Commission defined them in 1998 to end the argument over what a kilobyte means, taking the first two
letters of the SI prefix and adding the first two of "binary".

The habit they replaced came from hardware. Memory is addressed in powers of two, so 1,024 was the
round number in a memory chip long before anyone had a gigabyte of anything.

To divide a byte count by 1,073,741,824 yourself, or to check any figure on this page, use the
[Calculator](/calculator).
