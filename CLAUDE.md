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

Guest preferences use versioned local storage under `toolbox:preferences:v1`. The store uses an in-memory fallback when storage is unavailable.

Authenticated preferences sync semantic operations to one `Toolbox User Preference` record for each Frappe user. Do not replace this with blind full-state writes.

Home uses the same preference store for favorites, recent tools, saved currency pairs, and saved World Clock locations.

Use bounded whitelisted APIs for lookup data. Validate input on the server. Keep database queries indexed and limit all result sets.

Use staged releases for PIN and IFSC data. Validate a release before activation. Preserve the active release if an import fails.

## Authentication and Phase 2 ownership model

Toolbox is a single-owner, authenticated-only application. There is no guest, sharing, or multi-user access. The web entry `toolbox/www/toolbox.py` redirects `Guest` to the Frappe login, tool APIs are not `allow_guest`, and a client router guard (`frontend/src/utils/authGuard.js`) redirects on a lost session. Preferences sync only to the per-user server record.

Phase 2 personal records (notes, checklists, links, reminders, expenses, audio) are private to their owner. Follow this foundation (`toolbox/permissions.py`):

- Every real, enabled user is auto-enrolled in the `Toolbox User` role (User `after_insert` hook plus `backfill_toolbox_user_role` on migrate). `Toolbox Manager` administers shared configuration and does not get routine access to personal content.
- Personal DocTypes restrict access to the owner. Use `owner_query_conditions(doctype, user)` and `has_owner_permission(doc, user)` for permission hooks, or DocType `if_owner` permissions for the simple case. Administrators and System Managers keep the technical access inherent to running the site.
- Prefer owner-enforcing whitelisted methods over raw DocType REST for CRUD, matching the existing bounded-API pattern.

Reuse the shared Phase 2 primitives: `TagInput` (`components/inputs/TagInput.vue`) for tags, and `downloadTextFile` / `downloadJson` (`utils/fileExport.js`) for exports.

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

These utilities are operational:

- Calculator
- Unit Converter
- GST Calculator
- Financial Calculators
- Timer, Stopwatch, and Countdown
- Health and Fitness Calculators
- World Clock
- Currency Converter
- India Business Lookup (PIN and IFSC search)
- Weather
- Dictionary
- Checklists (Phase 2: private, owner-only checklists with items, reorder, and export)

HSN and SAC lookup works when India Compliance or ERPNext supplies the catalog. Its offline snapshot and dependency gate work.

PIN and IFSC release infrastructure, import validation, bounded APIs, UI, and tests work. Production-scale datasets are not active yet.

Weather and Dictionary remain placeholder tools that need provider and source validation.

## Active development priority

Productionize PIN and IFSC lookup before optional interaction polish.

1. Import the full official Department of Posts PIN CSV into `toolbox-test.localhost`.

2. Import a versioned Razorpay IFSC release into `toolbox-test.localhost`.

3. Verify source dates, checksums, counts, exclusions, and attribution.

4. Benchmark full-scale lookup queries.

5. Tune indexes and query shapes when measured latency requires changes.

6. Activate each release only after validation passes.

## Next development steps

1. Add administrator import and release-status controls for PIN and IFSC data.

2. Review permissions, rate limits, concurrency behavior, and superseded-release retention.

3. Finish HSN release gaps, including attribution, type rules, copy-code, and optional statutory fields.

4. Replace deprecated `limit_page_length` use in `toolbox/hsn_catalog.py` with the Frappe 17 `limit` argument.

5. Start Dictionary or Weather only after validating the data source, provider terms, caching, and failure behavior.

6. Run `yarn verify` and the full browser matrix before a release.

## Last verified baseline

The isolated Frappe test site passed 30 unit tests and 15 integration tests.

The frontend passed 434 tests across 51 files. The production Vite build passed.

Focused browser workflows passed for World Clock, Home saved items, GSTIN, PIN, and IFSC.

Run the full Playwright suite after the latest additions. Do not treat focused browser results as a full browser release check.

The last tracker count was 183 complete items and 98 open items, or 65.1 percent complete.
