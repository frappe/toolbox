# Toolbox Development Guide

## Project scope

Toolbox is a Frappe web application that provides small, focused utilities. It owns the whole site, so a tool sits directly under the root: `/calculator`, not `/toolbox/calculator`. `toolbox/routes.py` holds the reasoning and the explicit route list.

Prioritize useful features and correct results. Defer optional interaction polish, such as keyboard navigation, until core utility work is complete.

Preserve the current worktree. It contains active tracked and untracked work. Inspect `git status --short` before cleanup or broad edits.

## Technical overview

The backend uses Python 3.14, Frappe Framework 17 on the `develop` branch, MariaDB, and Redis.

The frontend uses Vue 3 Composition API with `<script setup>`. It also uses Frappe UI, Vue Router, Vite 8, and Tailwind CSS.

Vitest and Vue Test Utils cover frontend units and components. Playwright with Chromium covers browser workflows. Axe-core supports accessibility checks.

Ruff formats and lints Python. ESLint checks JavaScript and Vue files. Frontend formatting is done by hand. Do not run Prettier: the installed version reformats this codebase against its own conventions.

The Frappe app root is this directory. The frontend source is in `frontend/`. Vite writes production assets to `toolbox/public/frontend/`.

The Frappe website entry is `toolbox/www/toolbox.html`. The Vite build updates this entry and generates PWA release metadata and a service worker.

The central tool registry defines tool metadata and routes. Add tools through this registry instead of creating parallel navigation lists.

## Architecture and state

Use Vue Composition API and `<script setup>` for components.

Keep tool calculations in small pure functions when possible. Keep Frappe calls, browser storage, and UI state at clear boundaries.

The application does not use Pinia or Vuex. Shared preferences use the singleton `ToolboxPreferencesStore`.

Preferences use `sessionStorage` under `toolbox:preferences:v1`, so they last as long as the tab. The one exception is `theme`, which uses `localStorage` under `toolbox:theme:v1` so a returning visitor is not flashed a white page. The store falls back to memory when a browser blocks storage.

Tool history uses `sessionStorage` too, and keeps the last 10 entries for each tool. So do the calculator's own history, the dictionary's recent searches, and the timer workspace, which holds the timer, the stopwatch and the countdown. Each of the three used `localStorage` until it was moved, so each clears the key that left behind when it loads.

Nothing a visitor does is sent to the server. Do not add a preference, history, or draft that outlives the browser session.

Two keys live in `localStorage` today, and only two. `toolbox:theme:v1`, for the reason above, and the Currency Converter rate snapshot, which is the only thing that lets that tool convert on the first offline visit of a session. It holds public reference rates and names nobody.

The Weather forecast snapshot was the third until issue #206 settled it. A forecast is keyed by the place it is for, so keeping it recorded where a visitor looked, which is usually where they live. It uses `sessionStorage` now and clears the old key when it loads, and the weather page says so. The rule the two follow: cached public data may outlive the session, a record of the visitor may not.

`frontend/src/test/setup.js` replaces both storages with one test double and clears both after each test. A suite that defines only one tests the other against jsdom's own copy, which nothing clears between tests.

Use bounded whitelisted APIs for lookup data. Validate input on the server. Keep database queries indexed and limit all result sets.

Use staged releases for PIN and IFSC data. Validate a release before activation. Preserve the active release if an import fails.

## No accounts, no stored user data

Toolbox is a free public website. There is no signup, no login, and no user record. Every visitor is a Guest and the page renders the same for all of them.

The application stores nothing for a visitor. Five DocTypes remain, and all of them are read-only reference data: PIN, IFSC, HSN, Dictionary, and the release ledger that versions them.

Follow these rules:

- Do not add authentication, a role, a permission hook, or a DocType that holds visitor data. `OTHER_IDEAS.md` records the tools removed for exactly this reason. Read it before you propose a feature.
- A public endpoint needs `@frappe.whitelist(allow_guest=True, methods=["GET"])` and `@rate_limit`. Keep it a read. Frappe's `rate_limit` defaults to `ip_based=True`, so limits apply per visitor rather than per account.
- `toolbox/tests/test_guest_access.py` locks the public surface. It fails when a new whitelisted method becomes guest-reachable without being listed, which is the intended tripwire.
- The boot payload carries no identity. Do not add `user`, `full_name`, or `is_logged_in` to it. A page that names its visitor invites code that branches on who they are.

Toolbox runs no scheduled work. The 5-minute reminders cron went with the Reminders tool.

Reuse the shared primitives: `TagInput` (`components/inputs/TagInput.vue`) for tags, and `downloadTextFile` / `downloadJson` (`utils/fileExport.js`) for exports.

## Styling and accessibility

Use Frappe UI components for common controls and feedback.

Use Tailwind utilities and the existing semantic tokens. Prefer `surface`, `ink`, and `outline` tokens over isolated literal colors.

Build mobile-first layouts. Check narrow mobile, tablet, and desktop widths.

Support light and dark themes. Preserve visible focus states, labels, roles, and live regions.

Respect reduced-motion settings. Do not make animation necessary to understand state changes.

Write JavaScript and Vue with single quotes, no semicolons, and two-space indentation. Match the file you are editing. Do not run Prettier or `eslint --fix` to get there: both rewrite files that are already correct, and the diff then buries the change under reformatting.

Ruff uses Python 3.14, a 110-character line length, double quotes, and tab indentation.

## Commands

Run these commands from this app root unless a section says otherwise.

### Install and run

```bash
yarn install
yarn dev
yarn build
yarn --cwd frontend preview
```

### Lint and format

The project has no separate npm lint command. Pre-commit is the canonical entry point for Python.

```bash
pre-commit run ruff --all-files
pre-commit run ruff-format --all-files
pre-commit run eslint --all-files
```

Do not run `pre-commit run --all-files`. It includes the Prettier hook, which reformats the whole frontend.

The project has no separate TypeScript typecheck command.

### Frontend tests

```bash
yarn test
yarn --cwd frontend test:watch
yarn --cwd frontend test:coverage
yarn test:e2e
yarn test:e2e:smoke
yarn --cwd frontend test:e2e:headed
yarn --cwd frontend playwright install chromium
yarn verify
```

#### The frappe-ui test double

`frontend/src/test/setup.js` replaces every frappe-ui component with a stub. Follow one
rule when you change it:

**A stub may render less than the real component. A stub must never accept an input the
real component rejects, and must never render an output the real component omits.**

A stub that is kinder than the component turns the suite green over a broken app. Three
shipped defects were found this way, each of them invisible to a full test run: `Button`
drew a label the real component hides behind `icon`, `Button` kept a caller `aria-label`
that the real component overwrites with `label`, and `Slider` accepted a scalar model
where the real component needs an array and silently falls back to its minimum.

Read the component's `types.ts` and `.vue` source before you write a stub. The
`.api.md` files are generated and repeat the source JSDoc, including its errors.
`frontend/src/test/frappeUiStub.test.js` locks the contracts that were wrong before.

### Frappe commands

Run these commands from the bench root at `../..`.

```bash
bench --site toolbox.localhost migrate
bench --site toolbox-test.localhost migrate
bench --site toolbox-test.localhost run-tests --app toolbox
bench --site toolbox-test.localhost run-tests --module toolbox.tests.test_india_business
```

Let the dataset sync finish before you run the tests. `migrate` enqueues
`toolbox.dataset_sync.sync_datasets` on the long queue, and a dataset import holds row locks on
the tables the integration tests clear between cases. Running the suite straight after a migrate
fails one test with `QueryTimeoutError (1205) Lock wait timeout exceeded` and takes about 150
seconds; the same suite passes in about 2 seconds once the import is done.

### PIN and IFSC imports

Run imports from the bench root. Replace each placeholder with release-specific values.

```bash
bench --site <site> execute toolbox.india_business_data.import_pin_csv --kwargs '{"path":"<csv>","version":"<version>","source_updated_at":"<timestamp>"}'
bench --site <site> execute toolbox.india_business_data.import_ifsc_csv --kwargs '{"path":"<csv>","version":"<version>","source_updated_at":"<timestamp>"}'
```

Use the Department of Posts dataset from data.gov.in for PIN data. Apply the Government Open Data License India attribution.

Use the versioned Razorpay public-domain derivative for IFSC data. Label it as a derivative from RBI and NPCI data.

## Coding guidelines

Keep components focused on one tool or one shared UI responsibility.

Move reusable business rules into named modules. Test these modules without rendering a component.

Use explicit names that describe the business meaning. Use one name for each concept across the backend and frontend.

Validate user input before calculations and server calls. Return useful empty, loading, success, and error states.

Use Decimal-compatible server logic for money where binary floating-point can change results.

Keep public API responses small and stable. Do not expose internal DocType fields without a product need.

Use Frappe Query Builder or parameterized database APIs. Do not construct SQL with user-controlled strings.

Use advisory locks for release imports. Keep imports batched and idempotent.

Store SHA-256 source identities and release metadata. Record imported, duplicate, excluded, and incomplete row counts.

Add tests with each behavior change. Test the success path, invalid input, boundary values, and failure recovery.

Update the central registry, `toolbox/routes.py`, the page metadata in `toolbox/seo.py`, search metadata, tests, and tracker when you add a tool. Tests fail when the first three disagree, which is deliberate: a tool missing from one of them 404s on a hard refresh, or inherits another page's title in a search result. Write its page in `toolbox/content` as well: a tool with no content file still gets a heading, and nothing else for a search engine to read.

Do not add a new state library without a clear application-wide need.

Do not hide unresolved data quality or licensing limits behind UI availability.

## Decision path for code ambiguity

Follow this path in order.

1. Read the relevant product requirement in `FRAPPE_TOOLBOX_V1_SPEC.md` at the workspace root.

2. Read the current status and acceptance criteria in `V1_TODO.md`.

3. Inspect the central registry, route, adjacent tool, and its tests.

4. Preserve established data contracts, preference operations, and styling tokens.

5. Choose the implementation that delivers correct user utility with the smallest maintainable change.

6. Prefer server validation when correctness, security, licensing, or shared data is involved.

7. Prefer a pure frontend function when the behavior is deterministic and needs no protected data.

8. Add a focused test that records the chosen behavior.

9. Document a material product or architecture decision in `V1_TODO.md` or the relevant source documentation.

10. Ask the product owner only when the remaining choices change user-visible scope, data rights, or destructive behavior.

## Current application state

The application shell, desktop and mobile navigation, All Tools at the root, deterministic search, recent tools, and settings work. There is no Home page and no favorites; both went with the pivot.

Preferences work, for the length of the browser session. Saved currency pairs and World Clock locations work the same way. PWA installation, offline behavior, and update prompts work.

Each route sends its own `<title>`, description, canonical URL, social tags, and JSON-LD, built by `toolbox/seo.py` and rendered into the server response. The application serves its own `robots.txt` and `sitemap.xml`, which override Frappe's. Add a tool, and its metadata entry is required: a test fails when `seo.py` and `routes.py` disagree.

Each tool page also sends its heading and its content in the HTML, inside the element the application mounts on. Vue empties that element when it mounts, so the block is replaced rather than repeated. The text of one page is one Markdown file in `toolbox/content`, and `toolbox/content/README.md` states the format. The Vite build renders those files once and writes the committed JSON under `toolbox/content/pages`, which `toolbox/tool_content.py` reads on the server and the client imports as a lazy chunk. One renderer produces both, so the words a crawler reads and the words a visitor reads cannot drift apart. `seo.py` builds `FAQPage` and `HowTo` JSON-LD from the same file. Run `yarn build` after you edit a content file: a test fails when the generated files no longer match the Markdown.

Some tools share one view because they share the state behind it: the timer, the stopwatch and the countdown keep one workspace; the six financial calculators keep what was typed into each; the nine converters keep the value already entered. Each still has its own route, heading and metadata. The registry marks them with `family`, naming the view, and `variant`, naming which of its tools to render. `useToolFamily` reads the pair from the route, and the router throws if a family has no registered view.

Sharing a view is all a family means. A page does not offer its siblings: one item in the sidebar is one page, and the sidebar is the only place a tool is listed. A strip of links across the family used to sit above each of these tools, and it listed the same tools the sidebar already listed. Do not add it back, and do not add tabs to a tool page.

These 34 utilities are operational.

**Calculate:** Calculator · EMI · Compound Interest · SIP · CAGR · Future Value · Break-Even ·
BMI · BMR · TDEE · Pace.
**Convert:** Length · Area · Volume · Weight · Temperature · Speed · Time Unit · Data Storage ·
Fuel Consumption · Currency.
**India:** GST Calculator · HSN and SAC Lookup · PIN Code Search · IFSC Code Search.
**Time:** Timer · Stopwatch · Countdown Timer · World Clock.
**Information:** Weather · Dictionary · Script Conversion.
**Media:** Audio Recorder · Audio Editor.

Five of these were one tabbed tool each until the split: a tab has no URL, so one page competed
for several searches at once and nothing could link to the stopwatch.

HSN and SAC lookup reads Toolbox's own imported release, so it needs no ERPNext or India Compliance install. The India Compliance project compiles the dataset, and it is not a runtime dependency. There is no client-side snapshot, so the lookup needs a connection and says so when it has none.

All five datasets are Active at production scale: PIN 165,616 rows, IFSC 181,719, HSN 18,687, Dictionary 147,982, City 34,080 with 23,992 alternate names. Each one ships as a checksummed release through `toolbox/data/manifest.json`. The city dataset is the one bundled in the repository rather than downloaded, because it is small and static.

A city carries the names it is known by locally, because GeoNames names a place in whichever language it judges most common: Munich, not München. Those names live in `Toolbox City Alias` and are matched by an indexed prefix, the same way the city's own name is. They are search keys only. The interface always shows the city's own name.

`toolbox/city_names.py` owns the folding rule that turns a name or a query into a search key. The importer and the search must fold identically or a city becomes unreachable, so the rule has one home, and it imports nothing from Frappe because `scripts/build_city_dataset.py` uses it outside a bench.

Weather and Dictionary are complete tools, not placeholders. Weather forecasts come from MET Norway and it geocodes from the local city dataset. Dictionary reads the local WordNet 3.1 dataset, and answers three questions from it: what a word means, what else means it, and what it is the opposite of. The last two are gathered from every sense into one list for each part of speech, because WordNet records both against a single sense.

A failed call to MET Norway or the ECB answers 503 and records why in the Error Log, through `toolbox/provider_errors.py`. Use it for any new provider: it logs the cause once per provider per five minutes, with a deferred insert, because the caller raises next and an ordinary insert would go with the rollback.

## Active development priority

Toolbox is becoming a free public site on `frappe.tools`, with no accounts. Work the pivot in this order.

1. Split the tabbed tools into separate tools. Two levels only: category, then tool. Each new route needs an entry in the registry, in `toolbox/routes.py`, and in `toolbox/seo.py`.

2. Write the per-tool content that makes a page rank: FAQs, how the calculation is done, background, and worked examples. This waits for the split, so the text is written once against the final set of pages.

3. Reorganize the navigation and make All Tools compact.

4. Add the data-sources page and the Frappe entry points.

Routes moved to the site root, and each one renders its own metadata for search engines. Both are done.

`~/Toolbox/NEXT_STEPS.md` holds the detail and the reasoning.

## Next development steps

1. Add administrator import and release-status controls for the datasets. Every dataset is imported and Active at production scale, but an import and its release status both need a bench shell today.

2. Run `yarn verify` and the full browser matrix before a release.

## Last verified baseline

The isolated Frappe test site passed 204 tests.

The frontend passed 712 tests across 90 files. The production Vite build passed.

The full Playwright matrix passed 332 tests, with 6 skipped by design, across chromium, firefox, webkit, and mobile-chromium, in 4 minutes. It runs fully parallel: with no shared account there is nothing for specs to race on.

Run the full Playwright suite before a release. Do not treat focused browser results as a full browser release check.

Run it on its own. Two matrices at once, or one alongside a build, starve the single web server, and every spec then fails on a 30-second navigation timeout that reads like a real regression. Check the durations before believing such a failure: a real one finishes fast.

## Skill usage (always)

Invoke the matching skill automatically. Do not wait to be asked.

- Any Frappe work (DocType, controller, hook, whitelisted API, bench, scheduler
  job, permissions, tests): use `frappe-app-dev` before writing code.
- Any code edit: follow `code-style`. For Frappe code, `frappe-app-dev` takes
  precedence.
- UI, layout, or visual work: use `ui-design`.
- Before finalizing any diff or PR: run `quality-code-review`.
- Docs, commits, and PR text: write in the style of `technical-writing`. This
  matches the Simplified Technical English already used in this guide.

The global routing rules in `~/.claude/CLAUDE.md` also apply. This section repeats
them inside the repository so any agent that works here sees the same rules.
