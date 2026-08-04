<div align="center">

# Toolbox

Common calculators, converters, lookups, and everyday utilities — private by default.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

</div>

Toolbox is a Frappe Framework web app of small, focused utilities at `/toolbox`. It is
web-first and installable as a PWA. Results are deterministic (no AI), calculations run in
your browser wherever possible, and data is presented honestly — a fetch time is never shown
as a source-update time, and reference data is never labelled "live".

## Tools

| | |
|---|---|
| **Calculator** | Scientific expressions with history |
| **Unit Converter** | Length, mass, temperature, and more |
| **GST Calculator** | Add/remove GST; split CGST, SGST, IGST |
| **Financial Calculators** | EMI, compound interest, SIP, CAGR, break-even |
| **Health & Fitness** | BMI, BMR, maintenance calories, pace |
| **Timer** | Timer, stopwatch, and date countdown |
| **World Clock** | Compare time zones |
| **Currency Converter** | ECB reference rates, cached for offline |
| **India Business Lookup** | Search PIN codes and bank IFSC codes; plot PINs on an offline India map |
| **HSN & SAC Lookup** | Search Indian HSN and SAC codes and descriptions |
| **Weather** | Current conditions and a public forecast |
| **Dictionary** | English definitions from WordNet |

## Data sources

Dataset-backed tools ship their data through a versioned, checksum-verified manifest and show
the source's own "last updated" date. Sources and their licenses:

| Data | Source | License |
|---|---|---|
| PIN codes | Department of Posts, via [data.gov.in](https://www.data.gov.in/catalog/all-india-pincode-directory) | Government Open Data License – India |
| Bank IFSC codes | [Razorpay IFSC](https://github.com/razorpay/ifsc) (derived from RBI/NPCI) | Public domain |
| HSN & SAC codes | CBIC classification, via [India Compliance](https://github.com/resilient-tech/india-compliance) | GPL-3.0 |
| Dictionary | [Princeton WordNet 3.1](https://wordnet.princeton.edu/) | WordNet License |
| Currency rates | [European Central Bank](https://www.ecb.europa.eu/stats/eurofxref/) | Reference rates, for information only |
| Weather | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0 (free tier is non-commercial) |
| India map outline | [geoBoundaries](https://www.geoboundaries.org/) ADM1 | CC BY 2.5 IN |

## Installation

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app toolbox
```

## Development

```bash
cd apps/toolbox
yarn install
yarn dev            # Vite dev server
yarn build          # production assets
yarn test           # frontend unit tests (Vitest)
yarn test:e2e       # browser tests (Playwright)
```

Python tests run from the bench root:

```bash
bench --site <site> run-tests --app toolbox
```

## Contributing

This app uses `pre-commit` for formatting and linting (ruff, eslint, prettier, pyupgrade).
[Install pre-commit](https://pre-commit.com/#installation) and enable it:

```bash
cd apps/toolbox
pre-commit install
```

## License

[GNU Affero General Public License v3.0](license.txt)
