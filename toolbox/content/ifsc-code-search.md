## How it works

An IFSC identifies one bank branch for a NEFT, RTGS or IMPS transfer. The code is 11 characters
long. The first four letters name the bank, the fifth character is always 0, and the last six
identify the branch.

1. Type an IFSC, or the name of a bank, a branch, a city or a state.
2. Press Search.
3. Read the matching branches, each with its code and address.

A term of exactly 11 characters is treated as a whole IFSC and matched exactly. Anything shorter or
longer is matched against the start of a value, in one order: IFSC first, then bank name, then
branch, then city, then state. The first 20 branches are returned, with duplicates removed.

The term is put into capitals first, so the case you type makes no difference. A term from the
middle of a branch name returns nothing, because matching starts at the beginning of a value.

Each result gives the bank and branch, the code, the city, the district, the state, and the street
address when the source carries one.

The data comes from the **Razorpay IFSC dataset**, a versioned public-domain release derived from
RBI and NPCI publications. It is not a first-party download from the RBI, and the page says so. The
release in use is v2.0.61, dated 15 July 2026. It holds 181,719 branches, and 1,038 rows were left
out because the code was malformed or a required field was missing.

The search runs on the server, so it needs a connection. Without one, the page reports the dataset
as not available and no search runs.

## Worked examples

### The branch behind HDFC0000001

The code returns one branch. HDFC Bank, TULSIANI CHMBRS - NARIMAN PT, in GREATER MUMBAI,
MAHARASHTRA. The address reads 101-104 TULSIANI CHAMBERSFREE PRESS JOURNAL MARGNARIMAN
POINTMUMBAI MAHARASHTRA 400 021.

The address runs several lines together, exactly as the source stores it. Toolbox tidies the spacing
and changes nothing else.

### Finding a branch by name

A search for `Nariman` fills the result with branches whose name starts with that word. Among them
are UCBA0000529 for UCO Bank, INDB0000006 for Indusind Bank, IOBA0000625 for Indian Overseas Bank
and DCBL0000023 for DCB Bank.

## Frequently asked questions

### What do the parts of an IFSC mean?

The first four characters are letters and name the bank. The fifth is always 0. The last six
identify the branch, and they can be letters or digits. A row whose code breaks that shape is not
imported.

### Can I find the code from the bank and branch name?

Yes. Type the bank name, or the start of the branch name, and read the codes in the result. A
partial code works the same way, so `HDFC0` returns HDFC0000001, HDFC0000002 and the codes after
them.

### Why did my search return nothing?

Two rules explain most empty results. A term is matched against the start of a value, so a word from
the middle of a branch name finds nothing. A term of exactly 11 characters is read as a full IFSC,
so the branch name `MUMBAI MAIN` returns nothing while `MUMBAI MAI` returns the branches that carry
it.

### How current is the IFSC data?

The release in use is v2.0.61, dated 15 July 2026, with 181,719 branches. A branch that opened,
moved or merged after that date is not here yet. Confirm a code with the bank before you send money
to a new branch.

### Why does a city read GREATER BOMBAY?

Because that is the value in the source. Bank names, branch names, cities and addresses are stored
as published, with only the spacing tidied. The same city can appear under more than one spelling.

### Is my search stored?

No. There is no account, and what you type is not kept. The search does reach the server, because
the dataset lives there.

## Good to know

A result carries the code, the bank, the branch, the address, the city, the district and the state.
It carries no MICR or SWIFT code.

A search returns at most 20 branches. A large bank has thousands, so a bank name alone shows only
the first few of them.

For a post office and its postal code, use [PIN Code Search](/pin-code-search).
