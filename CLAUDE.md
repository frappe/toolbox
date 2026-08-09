# Toolbox Development Guide

## Project scope

Toolbox is a Frappe web application that provides small, focused utilities. The application route is `/toolbox`.

Prioritize useful features and correct results. Defer optional interaction polish, such as keyboard navigation, until core utility work is complete.

Preserve the current worktree. It contains active tracked and untracked work. Inspect `git status --short` before cleanup or broad edits.

## Technical overview

The backend uses Python 3.14, Frappe Framework 17 on the `develop` branch, MariaDB, and Redis.

The frontend uses Vue 3 Composition API with `<script setup>`. It also uses Frappe UI, Vue Router, Vite 8, and Tailwind CSS.

Vitest and Vue Test Utils cover frontend units and components. Playwright with Chromium covers browser workflows. Axe-core supports accessibility checks.

Ruff formats and lints Python. Prettier formats frontend files. ESLint checks JavaScript and Vue files. Pre-commit runs these tools.

The Frappe app root is this directory. The frontend source is in `frontend/`. Vite writes production assets to `toolbox/public/frontend/`.

The Frappe website entry is `toolbox/www/toolbox.html`. The Vite build updates this entry and generates PWA release metadata and a service worker.

The central tool registry defines tool metadata and routes. Add tools through this registry instead of creating parallel navigation lists.

## Architecture and state

Use Vue Composition API and `<script setup>` for components.

Keep tool calculations in small pure functions when possible. Keep Frappe calls, browser storage, and UI state at clear boundaries.

The application does not use Pinia or Vuex. Shared preferences use the singleton `ToolboxPreferencesStore`.

Preferences use `sessionStorage` under `toolbox:preferences:v1`, so they last as long as the tab. The one exception is `theme`, which uses `localStorage` under `toolbox:theme:v1` so a returning visitor is not flashed a white page. The store falls back to memory when a browser blocks storage.

Tool history uses `sessionStorage` too, and keeps the last 10 entries for each tool.

Nothing a visitor does is sent to the server. Do not add a preference, history, or draft that outlives the browser session.

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

Use Prettier output for JavaScript and Vue indentation when `.editorconfig` differs from Prettier.

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

The project has no separate npm lint command. Pre-commit is the canonical lint and format entry point.

```bash
pre-commit run --all-files
pre-commit run ruff --all-files
pre-commit run ruff-format --all-files
pre-commit run prettier --all-files
pre-commit run eslint --all-files
```

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

Update the central registry, route, search metadata, tests, and tracker when you add a tool.

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

The application shell, desktop and mobile navigation, Home, All Tools, deterministic search, favorites, recent tools, and settings work.

Guest and authenticated preferences work. Saved currency pairs and World Clock locations work. PWA installation, offline behavior, and update prompts work.

These 15 utilities are operational:

- Calculator
- Unit Converter
- GST Calculator
- Financial Calculators
- Timer, Stopwatch, and Countdown
- Health and Fitness Calculators
- World Clock
- Currency Converter
- India Business Lookup (PIN and IFSC search)
- HSN and SAC Lookup
- Weather
- Dictionary
- Script Conversion
- Audio Recorder
- Audio Editor

HSN and SAC lookup works when India Compliance or ERPNext supplies the catalog. Its offline snapshot and dependency gate work.

All four datasets are Active at production scale: PIN 165,616 rows, IFSC 181,719, HSN 18,687, Dictionary 147,982. Each one ships as a checksummed release through `toolbox/data/manifest.json`.

Weather and Dictionary are complete tools, not placeholders. Weather calls a live provider. Dictionary reads the local WordNet 3.1 dataset.

## Active development priority

Toolbox is becoming a free public site on `frappe.tools`, with no accounts. Work the pivot in this order.

1. Rebase routes to the site root, and render per-route meta on the server for search engines.

2. Split the tabbed tools into separate tools. Two levels only: category, then tool.

3. Reorganize the navigation and make All Tools compact.

4. Add the data-sources page and the Frappe entry points.

`~/Toolbox/NEXT_STEPS.md` holds the detail and the reasoning.

## Next development steps

1. Move Weather to the MET Norway provider. The Open-Meteo free tier permits non-commercial use only. Replace its geocoder with a bundled GeoNames city dataset.

2. Move Audio Recorder to browser-only capture. Cap a recording at 10 minutes or 100 MB.

3. Add synonyms and antonyms as sections inside Dictionary. Synonyms need no new data. 110,635 entries already carry them.

4. Add administrator import and release-status controls for the datasets.

5. Replace deprecated `limit_page_length` use in `toolbox/hsn_catalog.py` with the Frappe 17 `limit` argument.

6. Run `yarn verify` and the full browser matrix before a release.

## Last verified baseline

The isolated Frappe test site passed 93 tests.

The frontend passed 584 tests across 77 files. The production Vite build passed.

The full Playwright matrix passed 171 tests, with 6 skipped by design, across chromium, firefox, webkit, and mobile-chromium. It runs fully parallel: with no shared account there is nothing for specs to race on.

Run the full Playwright suite before a release. Do not treat focused browser results as a full browser release check.

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
