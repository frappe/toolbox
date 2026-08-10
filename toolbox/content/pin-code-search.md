## How it works

A PIN code is the six-digit postal index number in an Indian address. This tool reads a dataset of
post offices and returns the ones that match what you type.

1. Type a PIN code, or the name of a post office, a district or a state.
2. Press Search.
3. Read the matching offices, and find them on the map below the list.

Six digits are treated as a whole PIN code and matched exactly. Anything else is matched against the
start of a value, in one order: PIN code first, then office name, then district, then state. The
first 20 offices are returned, with duplicates removed.

A term matches the start of a value only. A search for `Vidhana` finds Vidhana Soudha S.O. A search
for `Soudha` finds nothing.

Former city names still work. A search for `Bangalore` also searches Bengaluru, and 18 other renamed
cities are handled the same way, among them Bombay, Calcutta, Madras, Gurgaon, Trivandrum and
Allahabad.

Each result gives the office name, the PIN code, the office type, the delivery status, the district
and the state. Offices that carry coordinates are drawn on a map of India under the list, and the
caption counts the ones the dataset cannot place.

The data comes from the **Department of Posts, Government of India**, published through data.gov.in
under the Government Open Data License India. The release in use is dated 10 June 2026 and holds
165,616 offices, with no row excluded.

The search runs on the server, so it needs a connection. Without one, the page reports the dataset
as not available and no search runs.

## Worked examples

### The post offices at PIN code 560001

Nine offices share 560001. Bengaluru G.P.O. carries the office type HO and the delivery status
Delivery. The other eight carry PO and Non Delivery, among them Vidhana Soudha S.O, Rajbhavan S.O
and HighCourt S.O.

All nine sit in the district the source writes as BENGALURU URBAN, in KARNATAKA.

### A search for Bangalore

The result lists offices under the current name. Bengaluru G.P.O. at 560001, Bengaluru City S.O and
Bengaluru Corporation Building S.O at 560002, Bengaluru Dist Offices Bldg S.O at 560009, and
Bengaluru vishwavidyalaya S.O at 560056.

## Frequently asked questions

### Why does one PIN code return several post offices?

A PIN code covers a delivery area rather than one building, and several offices can sit inside it.
560001 holds nine. The delivery status separates them. One office is marked Delivery and the
other eight are marked Non Delivery.

### Can I search by area name instead of the number?

Yes, as long as your term begins the name. Office name, district and state are all searched, in that
order. A partial word from the middle of a name returns nothing.

### Does an old city name still work?

Yes. Nineteen former names are mapped to the current one before the search runs, so Bangalore
reaches Bengaluru and Calcutta reaches Kolkata. The result always shows the current name, because
that is the name the dataset stores.

### Why is an office missing from the map?

Because the dataset has no usable coordinates for it. A pair is kept only when both numbers fall
inside India, and a half pair is dropped. The map caption counts the offices it could not place.

### How current is the PIN data?

The release in use is dated 10 June 2026 and holds 165,616 offices. The page names the source, the
license and that date under every search. A new office, or a renamed one, appears here only after
the Department of Posts publishes it and the release is replaced.

### Is my search stored?

No. There is no account, and what you type is not kept. The search does reach the server, because
the dataset lives there.

## Good to know

A search returns at most 20 offices. A state name matches thousands of them, so a broad term shows
only the first few in order. Add the district, or the office name, to reach the rest.

The map uses geoBoundaries state outlines under CC BY 2.5 IN, and plots the approximate office
coordinates India Post publishes.

For a bank branch and its code, use [IFSC Code Search](/ifsc-code-search).
