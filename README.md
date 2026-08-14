<div align="center">

<img src="toolbox/public/pwa/toolbox-192.png" alt="" width="96" height="96" />

# Toolbox

Free online calculators, converters and lookups. No account, and nothing stored about you.

[**frappe.tools**](https://frappe.tools) &nbsp;·&nbsp; [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

</div>

Toolbox is a Frappe Framework web application of small, focused utilities. It owns the whole
site, so each tool sits at the site root: `/calculator`, not `/toolbox/calculator`.

The site needs no account. There is no signup, no login, and no user record. Every visitor is a
Guest, and the page renders the same for all of them.

Results are deterministic, and Toolbox uses no AI. Most calculations run in the browser. Toolbox
also states the limits of its data. A fetch time is never shown as a source update time, and
reference data is never labeled "live".

A browser can install Toolbox as a PWA. Then 27 of the 34 tools work with no connection. The four
dataset lookups still need one, and the currency converter falls back to the rates it stored last.

## Tools

Toolbox has 34 tools in seven categories. Each tool has its own URL.

| Category | Tools |
|---|---|
| **Calculate** (7) | Calculator · EMI Calculator · Compound Interest Calculator · SIP Calculator · CAGR Calculator · Future Value Calculator · Break-Even Calculator |
| **Convert** (11) | Length Converter · Area Converter · Volume Converter · Weight Converter · Temperature Converter · Speed Converter · Time Unit Converter · Data Storage Converter · Fuel Consumption Converter · Currency Converter · Time Zone Converter |
| **Health** (4) | BMI Calculator · BMR Calculator · TDEE Calculator · Pace Calculator |
| **India** (4) | GST Calculator · HSN & SAC Lookup · PIN Code Search · IFSC Code Search |
| **Time** (4) | World Clock · Timer · Stopwatch · Countdown Timer |
| **Information** (2) | Dictionary · Script Conversion |
| **Media** (2) | Audio Recorder · Audio Editor |

## What Toolbox stores

Nothing on the server, and almost nothing in the browser.

Preferences and tool history use `sessionStorage`, so they end with the browser tab. Tool history
keeps the last 10 entries for each tool.

Two values use `localStorage`, and only two:

- The theme. It stops a returning dark-mode visitor from seeing a white page first.
- The European Central Bank rate table. It lets the currency converter work on the first offline
  visit of a session.

Both hold public data, and neither one names anybody.

## Data sources

Each dataset-backed tool ships its data through a versioned, checksum-verified manifest, and shows
the "last updated" date of the source itself. The live site lists the same information at
[frappe.tools/data-sources](https://frappe.tools/data-sources).

| Data | Source | License |
|---|---|---|
| PIN codes | Department of Posts, via [data.gov.in](https://www.data.gov.in/catalog/all-india-pincode-directory) | Government Open Data License – India |
| Bank IFSC codes | [Razorpay IFSC](https://github.com/razorpay/ifsc), derived from RBI and NPCI publications | Public domain |
| HSN & SAC codes | CBIC GST classification, compiled by [India Compliance](https://github.com/resilient-tech/india-compliance) | GNU General Public License v3 |
| Dictionary | [Princeton WordNet 3.1](https://wordnet.princeton.edu/) | WordNet License |
| Currency rates | [European Central Bank](https://www.ecb.europa.eu/stats/eurofxref/) | Reference rates, for information only |
| India map outline | [geoBoundaries](https://www.geoboundaries.org/) ADM1 | CC BY 2.5 IN |

The HSN and SAC lookup reads the release that Toolbox imports itself, so it needs no ERPNext or
India Compliance install. The India Compliance project compiles the dataset. It is not a runtime
dependency.

## Installation

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app toolbox
```

## Development

Run these commands from `apps/toolbox`.

```bash
yarn install
yarn dev            # Vite dev server
yarn build          # production assets
yarn test           # frontend unit tests (Vitest)
yarn test:e2e       # browser tests (Playwright)
yarn verify         # Vitest, build, Python tests, then Playwright
```

Run the Python tests from the bench root.

```bash
bench --site <site> run-tests --app toolbox
```

Let the dataset sync finish before you run the Python tests. `migrate` queues the sync, and an
import holds row locks that the integration tests wait for.

Run the full Playwright matrix on its own. Two matrices at once, or one beside a build, starve the
single web server, and every test then fails on a navigation timeout that reads like a real
regression.

The application icons are generated, not drawn by hand. Run `python scripts/generate_icons.py`
after any change to the geometry, then `python scripts/build_og_card.py` to rebuild the social
card from the new 512px icon.

## Contributing

This app uses `pre-commit` for formatting and linting. [Install
pre-commit](https://pre-commit.com/#installation) and enable it:

```bash
cd apps/toolbox
pre-commit install
```

Ruff formats and lints the Python. ESLint checks the JavaScript and Vue files.

Do not run `pre-commit run --all-files`. It includes the Prettier hook, and the installed version
reformats the whole frontend against its own conventions. Run one hook at a time instead:

```bash
pre-commit run ruff --all-files
pre-commit run ruff-format --all-files
pre-commit run eslint --all-files
```

Write JavaScript and Vue with single quotes, no semicolons, and two-space indentation.

## License

[GNU Affero General Public License v3.0](license.txt)
