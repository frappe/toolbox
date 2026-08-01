# Toolbox V1 Work Tracker

Last updated: 2026-08-01

Status values are complete, in progress, or open. Update this file with each development batch.

## Environment and project setup

- [x] SETUP Read and confirm the V1 product specification.
- [x] SETUP Install the supported Python, Node, Yarn, MariaDB, Redis, and Bench tools.
- [x] SETUP Create the Frappe development bench on the `develop` branch.
- [x] SETUP Create the `toolbox.localhost` site with a restricted database user.
- [x] SETUP Create and install the `toolbox` Frappe app.
- [x] SETUP Create an isolated `toolbox-test.localhost` site for automated Frappe tests.
- [x] SETUP Enable developer mode and isolate the development service ports.
- [x] SETUP Enable Frappe tests on the local development site.
- [x] BUILD Add the Vue 3, Frappe UI, Vite, and Tailwind frontend.
- [x] TEST Build the initial frontend and verify the `/toolbox` route.
- [ ] CLEAN Remove the preserved incomplete site directory from `/tmp` after final setup review.
- [ ] DOC Add local setup, development, build, test, and troubleshooting instructions.

## Milestone 1: Application foundation

- [x] BUILD Add one central registry for all committed and conditional V1 tools.
- [x] BUILD Add stable tool IDs, names, descriptions, icons, categories, and routes.
- [x] BUILD Add guest, offline, feature flag, and dependency fields to the registry.
- [x] TEST Validate all registry fields, enums, IDs, routes, and category references.
- [x] BUILD Generate all tool routes from the central registry.
- [x] BUILD Add the responsive desktop application shell.
- [x] BUILD Add the persistent desktop sidebar.
- [x] BUILD Add Home, All Tools, category, favorite, and Settings navigation.
- [x] FIX Keep all sidebar categories expanded and remove the sidebar Recent section.
- [x] BUILD Add the mobile header and navigation drawer.
- [x] BUILD Add a prominent mobile All Tools launcher.
- [x] BUILD Add deterministic local tool search.
- [x] FIX Make multi-token and fuzzy search ranking precise.
- [x] TEST Cover exact, prefix, token, typo, synonym, and deterministic search ranking.
- [x] BUILD Add guest favorite-tool persistence.
- [x] BUILD Add guest recent-tool persistence.
- [x] BUILD Store up to ten distinct recent tools.
- [x] BUILD Reserve preference lists for currency pairs, weather places, and world-clock places.
- [x] BUILD Add logged-in preference storage in Frappe.
- [x] TEST Cover local preference validation, corruption, storage failure, and reset behavior.
- [x] TEST Cover logged-in preference permissions and API behavior.
- [x] BUILD Add the fixed Home layout with favorites, recent tools, and a saved-items placeholder.
- [x] BUILD Show saved currency pairs and enabled weather and world-clock locations on Home.
- [x] TEST Cover Home saved-item display for guest and logged-in preferences.
- [x] BUILD Add the All Tools page with category filters.
- [x] BUILD Add number format and decimal precision settings.
- [x] BUILD Add date format, time format, and default currency settings.
- [x] BUILD Add metric, imperial, and temperature settings.
- [ ] BUILD Add administrator settings for tool feature flags and providers.
- [ ] BUILD Prevent a feature flag from bypassing dependency validation.
- [x] BUILD Add shared loading, empty, error, disabled, stale, and offline states.
- [ ] BUILD Add shared copy, reset, clear-input, and clear-error actions.
- [x] BUILD Add source, update time, cache age, and attribution components.
- [x] BUILD Add a development-only layout tweak panel.
- [x] FIX Expose CSRF and session boot data for future authenticated requests.
- [x] FIX Add visible keyboard focus and favourite states to tool rows.
- [x] SECURE Restrict the Vite development server to local hosts.
- [x] REVIEW Complete the initial foundation code-quality review.
- [ ] TEST Verify keyboard navigation and visible focus states.
- [ ] TEST Verify screen-reader names and semantic page landmarks.
- [ ] TEST Verify touch targets and non-color status indicators.
- [ ] TEST Verify reduced-motion behavior.
- [ ] REVIEW Complete the spacing, typography, contrast, alignment, fit, and repetition review.

## PWA and offline foundation

- [x] BUILD Add the scoped PWA manifest.
- [x] BUILD Add 192px, 512px, and maskable application icons.
- [x] BUILD Add the cached application shell.
- [x] BUILD Add safe service-worker registration and update handling.
- [x] BUILD Add a clear offline status.
- [x] BUILD Add an update-ready prompt.
- [x] BUILD Keep provider caches separate from the application-shell cache.
- [x] FIX Redirect `/toolbox` to `/toolbox/all-tools` so the canonical entry route is inside the service-worker scope without a Frappe trailing-slash redirect loop.
- [x] FIX Version application-shell caches per frontend build so older open tabs retain their lazy chunks.
- [ ] TEST Verify first install and installed-app launch.
- [x] TEST Verify offline launch and direct tool-route fallback.
- [x] TEST Verify safe application updates with an open page.

## Automated quality gate

- [x] BUILD Add a Playwright end-to-end test harness using real Chromium.
- [x] BUILD Add one-command frontend, build, Frappe, and browser verification.
- [x] TEST Cover canonical and direct tool-route smoke tests.
- [x] TEST Cover current Calculator, Unit Converter, GST Calculator, and Financial Calculators behavior.
- [x] TEST Cover authenticated preference persistence through the Frappe login UI.
- [x] TEST Cover offline relaunch and offline Calculator and Financial Calculators behavior.
- [x] TEST Cover desktop and mobile Chromium layouts for all current pages.
- [x] TEST Scan all current pages for serious WCAG A and AA violations.
- [x] FIX Raise secondary-text contrast to WCAG AA on light surfaces.
- [x] TEST Pass the latest full pre-GSTIN gate: 407 frontend, 23 Frappe unit, 13 Frappe integration, and 59 browser tests.
- [x] TEST Pass the GSTIN frontend gate: 422 frontend tests and the production build.
- [x] TEST Complete live browser visual and interaction passes for Calculator and Financial Calculators.
- [ ] TEST Add an end-to-end behavior spec with every future tool and user-visible workflow.
- [x] TEST Add India Business Lookup to direct-route, responsive, accessibility, and offline browser coverage.
- [ ] TEST Run the supported desktop browser matrix beyond Chromium.
- [ ] TEST Add tablet, dark-theme, reduced-motion, and manual screen-reader coverage.
- [ ] TEST Verify installed PWA launch outside the browser tab.
- [ ] TEST Run a live visual and behavioral review before each milestone is declared complete.

## Milestone 2: Comprehensive Calculator

- [x] BUILD Add the calculator expression editor and keypad.
- [x] BUILD Add arithmetic, percentage, parentheses, sign, backspace, and clear actions.
- [x] BUILD Add powers, roots, logarithms, constants, and trigonometric functions to the calculator engine.
- [x] BUILD Add degree and radian modes to the calculator engine.
- [x] SECURE Add a parser that never uses JavaScript `eval`.
- [x] BUILD Add safe syntax and domain errors for invalid expressions.
- [x] BUILD Add persistent calculation history with reuse, copy, delete, and clear actions.
- [x] BUILD Add full keyboard controls.
- [x] TEST Cover precedence, nested parentheses, functions, modes, and edge cases.
- [x] TEST Cover parser code-injection attempts.
- [x] TEST Verify keyboard input and offline use.
- [ ] TEST Verify full keyboard-only navigation.

## Milestone 2: Unit Converter

- [x] BUILD Add the central conversion registry and canonical base-unit model.
- [x] BUILD Add length, area, volume, mass, temperature, speed, time, storage, and fuel categories.
- [x] BUILD Add explicit temperature and fuel-consumption formulas.
- [x] BUILD Add two-way input, unit swap, immediate conversion, and copy.
- [x] BUILD Add unit search and recent unit pairs.
- [x] TEST Cover every V1 category and known conversion vectors.
- [x] TEST Cover round trips, temperature formulas, and reciprocal fuel formulas.
- [x] TEST Verify offline use.

## Milestone 2: GST Calculator

- [x] BUILD Add the central standard GST-rate registry and custom rates.
- [x] BUILD Add the Add GST mode.
- [x] BUILD Add the Remove GST mode.
- [x] BUILD Add intra-state CGST and SGST splits.
- [x] BUILD Add inter-state IGST calculations.
- [x] BUILD Add the HSN lookup rate handoff.
- [x] BUILD Add the structured copy summary.
- [x] TEST Cover reversibility, rounding, standard rates, and custom rates.
- [x] TEST Verify offline use.

## Milestone 2: World Clock and Time Zone Planner

- [x] VALIDATE Select an openly usable city-to-IANA-time-zone dataset.
- [x] BUILD Add city and time-zone search.
- [x] BUILD Add, remove, reorder, and favorite locations.
- [x] BUILD Show local time, date, UTC offset, day difference, and daylight-saving state.
- [x] BUILD Add the shared time slider.
- [x] BUILD Add shared working hours and overlap highlighting.
- [x] BUILD Add selected-time copy actions.
- [x] TEST Cover daylight-saving transitions and date changes.
- [x] TEST Cover working-hour overlap and slider updates.
- [x] TEST Verify core offline use.

## Milestone 2: Financial Calculators

- [x] BUILD Add EMI results and the amortization schedule.
- [x] BUILD Add compound interest with optional recurring contributions.
- [x] BUILD Add SIP projection.
- [x] BUILD Add CAGR calculation.
- [x] BUILD Add break-even quantity and revenue calculation.
- [x] BUILD Show inputs, assumptions, formulas, results, supporting values, and the required disclaimer.
- [x] SECURE Keep financial inputs in the browser and out of persistence and external requests.
- [x] SECURE Bound calculation sizes and amortization rows before allocating work.
- [x] TEST Add documented vectors for every formula.
- [x] TEST Reconcile amortization principal, interest, and final balance.
- [x] TEST Cover invalid values, overflow bounds, and explicit rate periods.
- [x] TEST Verify direct launch, mobile layout, accessibility, and offline use.
- [x] REVIEW Complete the Financial Calculators code-quality and visual-design reviews.

## Milestone 2: Timer, Stopwatch, and Countdown

- [x] BUILD Add one active timer with label, pause, resume, reset, and alarm.
- [x] BUILD Add the stopwatch with pause, resume, reset, and laps.
- [x] BUILD Add duration and date-time countdown modes.
- [x] BUILD Store timestamps and derive elapsed or remaining time from the clock.
- [x] BUILD Add safe refresh recovery.
- [x] BUILD State browser suspension limits clearly.
- [x] TEST Cover pause, resume, refresh, laps, date changes, and one active alarm.
- [x] TEST Verify offline use.

## Milestone 2: Health and Fitness Calculators

- [x] BUILD Add metric and imperial BMI calculation with categories and limitations.
- [x] BUILD Add BMR calculation with the formula name.
- [x] BUILD Add daily maintenance calorie calculation with activity assumptions.
- [x] BUILD Add the distance, duration, and pace calculator.
- [x] BUILD Add the required health disclaimer.
- [x] SECURE Keep all health inputs in the browser by default.
- [x] TEST Cover boundary values and published formula examples.
- [x] TEST Compare metric and imperial results within tolerance.
- [x] TEST Verify offline use.

## Milestone 3: Currency dependency validation

Provider decision:

- Use the European Central Bank daily XML feed. It provides dated institutional reference rates without an API key.
- Quote “Source: ECB statistics.” The ECB permits free commercial and non-commercial reuse with source attribution.
- Treat the rates as information-only reference rates. Do not describe them as transaction rates.
- Expect about 30 currencies and working-day updates near 16:00 CET. Do not promise continuous availability or full currency coverage.
- Fetch through the Toolbox server every six hours at most. Send no user amount, selected pair, identity, or browser data to the ECB.
- Keep a shared stale cache for 30 days and a versioned browser snapshot. Label each fallback state clearly.

- [x] VALIDATE Select an openly usable institutional reference-rate provider.
- [x] VALIDATE Confirm production terms, attribution, limits, dates, reliability, and privacy.
- [x] DOC Record the provider decision and limitations.
- [x] BUILD Add the narrow currency provider adapter.
- [x] BUILD Add server caching without per-keystroke provider requests.
- [x] BUILD Add amount conversion, search, swap, defaults, favorites, source, date, and copy.
- [x] BUILD Add stale cached-rate use and honest stale labels.
- [x] TEST Mock provider success, invalid data, failure, caching, and stale fallback.
- [x] TEST Verify offline use of the last cached rate.

## Milestone 3: HSN, SAC, and GST dependency validation

Dependency contract:

- Use the fixed `india_compliance` app identifier. India Compliance requires ERPNext.
- The source review used India Compliance `develop` commit `205c3de939bd99cc1df1e0d1cb76cff2e76eee55` from 2026-07-31.
- Query the `GST HSN Code` DocType. Require `hsn_code` and `description` with compatible field types.
- The reviewed master contains 18,687 four-, six-, and eight-digit records. Its `All` role has read access.
- Return only contract-approved public fields. Fail closed when the required schema changes.
- The current DocType has no statutory GST rate, cess, effective-date, or statutory-source field.
- Do not infer a statutory rate from the `taxes` table. It stores site-configured Item Tax Template links.
- Enable a GST Calculator handoff only when a future compatible contract provides an explicit `gst_rate` field.
- Let System Managers use Cloud Settings only when the Marketplace marks India Compliance installable.
- Require an explicit POST confirmation. Store each accepted or failed request in the Frappe Activity Log.
- For other hosts, link administrators to the official installation guide. Do not run host commands from the browser.
- Store complete browser snapshots in IndexedDB. Keep the source version, source change time, record count, and snapshot time separate.

- [x] VALIDATE Confirm India Compliance requires ERPNext and is a substantial site dependency.
- [x] VALIDATE Confirm the current India Compliance master stores HSN codes and descriptions locally but no authoritative statutory GST-rate field.
- [x] DECIDE Query the India Compliance master live on the site and create a versioned browser snapshot for offline search.
- [x] BUILD Add blocked, installable, installing, ready, failed, and unsupported dependency states.
- [x] BUILD Show the India Compliance requirement before any HSN or GST lookup action.
- [x] BUILD Add an authorized in-product Frappe Cloud Marketplace install flow where Cloud Settings supports it.
- [x] BUILD Add a safe administrator handoff when the hosting environment cannot install apps in-product.
- [x] SECURE Restrict installation to System Managers, a fixed app identifier, explicit confirmation, and auditable POST actions.
- [x] TEST Cover guest, non-administrator, cloud install, unsupported host, failed install, retry, and successful activation paths.
- [x] VALIDATE Confirm India Compliance HSN, SAC, GST, cess, effective-date, and source fields.
- [ ] VALIDATE Confirm the India Compliance HSN master data license and required production attribution.
- [ ] VALIDATE Confirm a reliable HSN-versus-SAC type rule before labeling each result.
- [x] VALIDATE Confirm search access and upgrade compatibility.
- [x] DOC Record the dependency contract and missing fields.
- [x] BUILD Add a safe missing-dependency state for normal and authorized users.
- [x] BUILD Add a narrow Toolbox adapter over the installed India Compliance HSN DocType.
- [x] BUILD Add a versioned offline browser snapshot with source version, record count, and refresh time.
- [x] BUILD Refresh the offline snapshot after India Compliance changes without duplicating its backend master.
- [x] BUILD Add exact code, prefix, phrase, word, fuzzy, and typo-tolerant search.
- [x] BUILD Add stable ranked results and the GST Calculator handoff.
- [ ] BUILD Add a copy-code action to each HSN and SAC result.
- [ ] BUILD Show GST rate, cess, effective date, and statutory source when the dependency provides them.
- [ ] BUILD Omit the result type when neither dependency data nor a validated rule identifies it.
- [x] TEST Cover code, phrase, prefix, fuzzy, typo, and missing-field behavior.
- [ ] TEST Cover HSN result copy, optional field display, omission, and saved-snapshot validation.
- [x] TEST Cover online search, offline snapshot search, refresh, interrupted refresh, and stale snapshot labels.
- [x] TEST Verify full-dataset search performance.

## Milestone 3: India Business Lookup dependency validation

- [x] VALIDATE Select authoritative and legally usable PIN and IFSC datasets.
- [x] VALIDATE Confirm source, license, version, date, update, and import requirements.
- [x] DOC Record both dataset decisions and limitations.
- [x] BUILD Add repeatable staged PIN and IFSC imports.
- [x] BUILD Keep the current valid dataset when an import fails.
- [x] BUILD Add PIN search by code, office, district, and state.
- [x] BUILD Add IFSC search by code, bank, branch, city, and state.
- [x] BUILD Add local GSTIN structure, state, PAN, sequence, and checksum validation.
- [x] BUILD Add the required GSTIN limitation statement.
- [x] TEST Cover documented valid and invalid GSTIN structure and checksum vectors.
- [x] TEST Cover staged imports, failed replacements, and PIN and IFSC searches.
- [ ] TEST Verify large-dataset search performance.

## Milestone 3: Weather dependency validation

- [ ] VALIDATE Select a production-suitable weather provider and location source.
- [ ] VALIDATE Confirm terms, attribution, limits, reliability, time zones, and privacy.
- [ ] DOC Record provider and location decisions.
- [ ] BUILD Add narrow weather and location adapters.
- [ ] BUILD Add location search and coordinate caching.
- [ ] BUILD Show current temperature, feels-like temperature, condition, and daily minimum and maximum.
- [ ] BUILD Add the next 24 hours and seven-day weather forecasts.
- [ ] BUILD Show rain, humidity, wind speed and direction, sunrise, sunset, source, and update time.
- [ ] BUILD Add saved places, provider attribution, retry, cache age, and stale fallback.
- [ ] TEST Mock provider success, invalid data, failures, mapping, and time zones.
- [ ] TEST Verify cached data after provider failure.
- [ ] TEST Verify a failed or invalid refresh keeps the last valid weather data without fabricated values.

## Milestone 3: Dictionary dependency validation

- [ ] VALIDATE Select an openly licensed English dictionary dataset.
- [ ] VALIDATE Confirm attribution, coverage, size, import time, search speed, and updates.
- [ ] DOC Record the dataset decision and unavailable fields.
- [ ] BUILD Add a repeatable staged dictionary import.
- [ ] BUILD Add exact word search, definitions, parts of speech, pronunciation text, examples, and a missing-word state.
- [ ] BUILD Add deterministic spelling suggestions and recent searches.
- [ ] BUILD Show the dictionary source, license attribution, and available dataset update date.
- [ ] BUILD Omit unavailable pronunciation and example fields without replacement values.
- [ ] TEST Cover exact lookup, suggestions, missing words, fields, and repeatable imports.
- [ ] TEST Verify search performance without a runtime third-party API.

## Public data efficiency and freshness

- [x] DECIDE Treat data efficiency, freshness, source, and stale behavior as shared V1 requirements.
- [x] DECIDE Keep source update time, fetch time, and offline snapshot time as separate values.
- [ ] BUILD Add one provider and dataset metadata contract with source, license, attribution, version, update time, fetch time, expiry, checksum, and record count.
- [ ] BUILD Share provider and dataset caches across users without exposing user-specific data.
- [ ] BUILD Add configurable cache durations based on each dataset's expected change rate.
- [ ] BUILD Add request deduplication, batching, compression, pagination, and conditional requests where the source supports them.
- [ ] BUILD Prevent per-keystroke external requests with local search, debounce, minimum query lengths, and server caching.
- [ ] BUILD Add stale-while-revalidate behavior and safe fallback to the last valid data.
- [ ] BUILD Keep the last valid dataset when a refresh is incomplete or invalid.
- [ ] BUILD Add indexes for every committed PIN, IFSC, and Dictionary server-search field.
- [ ] BUILD Keep complete large datasets out of the initial application download.
- [ ] BUILD Add backoff and retry limits for provider failures and rate limits.
- [ ] BUILD Show Source updated, Last checked, Offline copy refreshed, and Stale labels only when each value is known.
- [ ] BUILD Never label a fetch time as a source update time.
- [ ] TEST Measure request count, transferred bytes, cache hit rate, refresh behavior, and stale fallback for every provider.
- [ ] TEST Cover missing timestamps, clock differences, invalid metadata, interrupted refreshes, and unchanged datasets.
- [ ] DOC Record each provider's refresh policy, cache duration, attribution, rate limits, and offline behavior.

## Shared backend, security, and data work

- [x] FIX Bound preference requests and keep local tools available while account preferences load or save.
- [x] FIX Retry preference loading and pending saves after reconnect with semantic conflict merging.
- [x] FIX Handle concurrent first saves and stale multi-tab preference updates without lost data.
- [ ] BUILD Add administrator settings for locale, country, cache duration, providers, and dataset state.
- [ ] BUILD Add authorized dataset import actions and provider error summaries.
- [ ] BUILD Add permission checks for all settings, imports, and logged-in preferences.
- [ ] SECURE Validate every server input.
- [ ] SECURE Treat provider payloads and imported datasets as untrusted.
- [ ] SECURE Escape all external and imported content.
- [ ] SECURE Add rate limits to public server endpoints.
- [ ] SECURE Keep provider secrets out of browser code and responses.
- [ ] SECURE Prevent logs from recording financial or health inputs.
- [ ] SECURE Prevent raw stack traces and provider payloads in user errors.
- [ ] TEST Cover permissions, rate limits, invalid input, and guest access.
- [ ] TEST Cover cache freshness, stale age, and invalid replacement behavior.
- [ ] REVIEW Complete a security review before release.

## Release testing and hardening

- [ ] TEST Run all frontend unit tests.
- [ ] TEST Run all Frappe server tests.
- [ ] TEST Run formula and parser test vectors.
- [ ] TEST Run provider and dataset tests with mocks and fixtures.
- [ ] TEST Run desktop, tablet, and mobile layout checks.
- [ ] TEST Run keyboard-only and screen-reader checks.
- [ ] TEST Run light, dark, and reduced-motion checks.
- [ ] TEST Run guest and logged-in behavior checks.
- [ ] TEST Run offline launch and network-loss checks.
- [ ] TEST Run empty, loading, error, disabled, and stale-state checks.
- [ ] TEST Run performance checks for startup, local calculations, and large searches.
- [ ] TEST Verify tool navigation does not reload the application shell.
- [ ] TEST Verify the initial application load does not download complete large datasets.
- [ ] TEST Install and upgrade the app on a clean Frappe site.
- [ ] CLEAN Remove dead code, unused dependencies, stale flags, and generated debug files.
- [ ] CLEAN Check formatting, lint output, type output, and build warnings.
- [ ] DOC Add user documentation for each released tool.
- [ ] DOC Add administrator, provider, dataset, attribution, and update documentation.
- [ ] DOC Record every disabled conditional tool and its validation gap.
- [ ] REVIEW Confirm that no Other Ideas feature entered V1.
- [ ] REVIEW Confirm that no mandatory proprietary dependency entered V1.
- [ ] REVIEW Confirm each feature against its Definition of Done.
- [ ] RELEASE Create the V1 release notes and upgrade notes.
- [ ] RELEASE Tag the V1 release after all committed tools pass.
