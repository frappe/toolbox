## How it works

An HSN code classifies a good. A SAC classifies a service. This tool searches one catalog that holds
both, and returns the code, its type and the description the classification gives it.

1. Type a code, or a word from a description.
2. Press Search.
3. Read the matching codes, each labeled HSN or SAC.

What you type decides how the search runs. A term of digits only matches the start of a code, so
`8517` returns 8517 and every longer code under it. A term with letters matches anywhere inside a
description, and anywhere inside a code. A search needs 2 to 80 characters and returns at most 25
rows, ordered by code.

A code that starts with 99 is a SAC and carries the SAC label. Every other code carries the HSN
label. A row without a description, or with a code shorter than two digits, is not imported at all.

The catalog is the **CBIC GST HSN/SAC classification**, compiled by the India Compliance project and
published under the GNU General Public License v3. Toolbox imports it as a checksummed release. The
active release holds 18,687 codes, and its source is dated 25 June 2024. No install of ERPNext or
India Compliance is needed to read it.

The search runs on the server. There is no copy of the catalog in your browser, so the lookup needs
a connection. Without one, the page reports the dataset as not available and no search runs.

## Worked examples

### The codes for telephones under 8517

A search for `8517` returns the four-digit 8517, whose description begins "TELEPHONE SETS, INCLUDING
TELEPHONES FOR CELLULAR NETWORKS OR FOR OTHER WIRELESS NETWORKS", and the codes below it.

Among them are 851712, "TELEPHONES FOR CELLULAR NETWORKS OR FOR OTHER WIRELESS NETWORKS", and
85171219, "MOBILE PHONE, PUSH BUTTON TYPE".

### The service codes for information technology

A search for `9983` returns 9983, "Other professional, technical and business services", together
with 998313, "Information technology (IT) consulting and support services", and 998314, "Information
technology (IT) design and development services".

These are labeled SAC, because the code starts with 99.

## Frequently asked questions

### What is the difference between an HSN code and a SAC code?

HSN classifies goods and SAC classifies services. Both are searched here, and each result says which
one it is. A SAC starts with 99.

### Can I search by description instead of by number?

Yes. A term with letters is matched anywhere inside the description, so a search for `coffee`
returns 0901, which begins "COFFEE, WHETHER OR NOT ROASTED OR DECAFFEINATED", and the codes under
it.

A term of digits behaves differently. It matches only the start of a code, so more digits narrow the
result rather than widen it.

### Does the lookup show the GST rate for a code?

No. It returns codes and descriptions only. A rate comes from a notification and applies from an
effective date, so confirm the rate for a code against an official source. Once you have it, work
out the tax with the [GST Calculator](/gst-calculator).

### How many digits does a code have?

The catalog holds codes of two, four, six and eight digits. Each length is a level of one tree, and
a longer code narrows the description of a shorter one. How many digits an invoice must carry is set
by rules that change, so confirm that separately.

### Where do the codes come from, and how current are they?

From the CBIC GST HSN/SAC classification as compiled by the India Compliance project, under the GNU
General Public License v3. The release in use holds 18,687 codes and is dated 25 June 2024. The page
names the source and that date under every search.

### Is my search stored?

No. There is no account, and what you type is not kept. The search does reach the server, because
the catalog lives there.

## Good to know

Descriptions are reproduced as the source writes them. That is why most goods read in capitals and
most services read in sentence case. Nothing is rewritten on the way to the page.

A search returns at most 25 rows, ordered by code, so a broad term shows the lowest codes first. Add
digits, or a more specific word, to narrow it.
