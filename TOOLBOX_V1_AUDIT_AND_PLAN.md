# Toolbox V1 — Codebase Audit & Comprehensive Plan

**Date:** 2026-08-01
**Method:** Full-codebase read via 6 parallel domain audits (backend data, backend services, calc tools, time tools, frontend shell/PWA, spec-compliance+build). Cross-checked against `FRAPPE_TOOLBOX_V1_SPEC.md` and `CLAUDE.md`.
**Verification observed:** vitest **434/434 pass** (51 files), production Vite build **clean** (~2.7s, no warnings). Playwright e2e **not re-run** since recent PIN/IFSC/World Clock/Home work. Python tests not executed in this pass.

---

## 1. What is solid (verified, no action needed)

- **Architecture is genuinely registry-driven** — router, sidebar, and search all derive from `src/data/toolRegistry.js`; no parallel hard-coded nav list. All §7.2 fields present.
- **Calculator is `eval`-free** — hand-written tokenizer/recursive-descent parser/tree-walking evaluator; injection tests pass. Precedence, right-assoc power, degree/radian trig, domain guards all correct.
- **GST money-math uses BigInt minor units** (Decimal-correct per CLAUDE.md). Unit-converter factors all numerically accurate. EMI schedule reconciles.
- **Currency backend** — clean ECB provider adapter, UI insulated from payload, 6h fresh / 30d stale caching, failure falls back to labeled stale, rates labeled "not transaction rates". Validated as untrusted.
- **Preferences** — semantic per-user-row-locked sync (no lost-update); blind full-state write deliberately not whitelisted. Prototype-pollution/depth/size guards present.
- **HSN** — DocType-contract gated before exposure; missing fields omitted not fabricated; graceful when India Compliance absent.
- **GSTIN validator — checksum verified correct** against canonical GSTNs; mandatory disclaimer present.
- **PIN/IFSC importer schema matches the real CSV headers** — import is **not** blocked.
- **PWA/offline** — versioned shell cache with generational pruning, offline fallback, update-ready prompt, IndexedDB/localStorage snapshot stores.
- **SQL is Query-Builder/parameterized throughout**; no `eval`; no provider secrets.

---

## 2. Consolidated findings (deduped, by theme)

Severity: **Critical** none found · **High** = fix before release / before it bites · **Medium** = product-correctness or notable defect · **Low** = hygiene/edge.

### A. Security hardening — systemic (spec §10.3)
- **[HIGH] No rate limiting on ANY guest endpoint.** `currency.py:23`, `hsn_catalog.py:23`, `hsn_dependency.py:18`, `india_business.py:9,19,45`. `@frappe.rate_limit` is unused app-wide. Worst case `get_hsn_catalog` with no `known_revision` = unbounded 25k-row read + per-row regex normalize per anonymous call → cheap DoS amplifier. **Both backend audits flagged this independently.**
- **[LOW→MED] ECB XML parsed with stdlib `xml.etree`** (`currency_provider.py:9,68`) — entity-expansion exposure; use `defusedxml`. (Low likelihood: fixed HTTPS ECB source.)
- **[LOW] `get_context` leaks internal `site_name` to browser** (`www/toolbox.py:14`). **[LOW]** SW registers at root scope (`toolbox-sw.js:79`) — harmless (fetch handler passes non-toolbox through) but broad.

### B. PIN/IFSC release safety — the active priority (spec §8.8/§9.3)
- **[HIGH] Re-importing a previously-superseded checksum silently reactivates the OLD release and demotes the current newer one.** `india_business_data.py:81-84`. Re-running last month's import command (same file) is not a no-op — it rolls users back to stale data. **Must fix before we do repeatable imports.**
- **[MED] Failure audit is rolled back with the transaction** — `status=Failed`/`failure_reason` never durably persists under `bench execute` (`india_business_data.py:95-102`). No post-mortem trail. (Headline "failed import doesn't delete active data" safety property still holds.)
- **[MED] `exclusion_count` conflates invalid rows + in-file duplicates** into one counter (`india_business_data.py:117,122,126`); CLAUDE.md wants imported/duplicate/excluded/incomplete separately. Doctype JSON lacks the fields.
- **[MED] Superseded record rows never pruned** — PIN/IFSC tables grow ~150k rows per release forever (`_activate_release`, `india_business_data.py:217-232`). Correctness unaffected; storage/index-write cost unbounded.
- **[LOW] `bulk_insert` omits `creation/modified/owner/modified_by`** (`:235-237`) — non-standard rows. **[LOW]** redundant single-col + composite indexes. **[LOW]** OR-of-LIKE not reliably index-served. **[LOW]** opaque error on malformed `source_updated_at`.

### C. Known cleanup
- **[LOW] Deprecated `limit_page_length`** confirmed at `hsn_catalog.py:98` → replace with Frappe-17 `limit`. (Still works as alias; also loads full HSN master into memory.)

### D. Product-correctness & honest-data (spec §5.9, §7.6)
- **[MED] §7.6 number-format setting is decorative in most tools.** Only Currency & Financial read `numberFormat`/`decimalPrecision`. **GST hardcodes `en-IN`** (`useGstCalculator.js:210`), **Health uses raw `.toLocaleString()`**, **Calculator/Unit Converter ignore it**. Toggling Indian↔international / precision silently does nothing in 4 tools. No test catches it.
- **[MED] Currency UI can render the prohibited word "Live"** — `rateSnapshot.js:25` allows `cacheStatus:'live'` → `CurrencyConverterView.vue:25` shows "Rate status: Live". Spec §5.9 forbids describing reference rates as live.
- **[MED] Tool visibility is inconsistent across the 3 registry consumers.** Router = all; sidebar = all (no badge); search = only `releaseStatus==='available'`. Result: `india-business-lookup` is **live and in the sidebar but returns "No matching tools" in ⌘K search** (`ToolSearchDialog.vue:69`); `weather`/`dictionary` sit in the sidebar as dead-ends with no in-nav "Validating" badge (AllTools grid *does* badge them).
- **[MED] `featureFlag` registry field is inert** — declared + defaulted but read by no code path. Flags cannot hide/expose anything.
- **[LOW] Disabled tools pollute "Recent"** (`ToolView.vue:57-63`). **[LOW]** PIN/IFSC honest-labeling (IFSC "derivative, not first-party RBI"; PIN DoP/data.gov.in attribution) is delegated entirely to backend metadata, not enforced client-side (latent until datasets active).

### E. Time tools — two real bugs (spec §8.10)
- **[MED] Started countdown is never persisted → lost on refresh** (`useTimerWorkspace.js:43` — `setCountdown` omits `persist()`). Timer & stopwatch survive refresh; countdown doesn't. Violates "refresh recovery is correct".
- **[MED] Expired running timer re-fires its alarm on every page reload** (`useTimerWorkspace.js:11,17,21,49` — DONE state never persisted). Refresh a tab with an expired timer → alarm sounds again each time.
- **[LOW] DST label mislabels negative-DST zones** (Europe/Dublin) via a two-sample min-offset heuristic (`worldClock.js:115-120,47`). **[LOW]** working-hours range has no overnight/wrap and no start<end guard → unsatisfiable ranges show "outside" everywhere. **[LOW]** 30s clock refresh staleness. **[LOW]** countdown-zero has no alarm/notification (spec-compliant, UX gap).

### F. Test coverage gaps (where wrong values pass silently)
- **Linear conversion factors are tested against their own declared constants** (tautological) — a typo like `mile:1609` would pass. Temperature/fuel *do* have absolute vectors. → add absolute ground-truth vectors.
- **`useTimerWorkspace.js` and `useWorldClock.js` have ZERO tests** — exactly where bugs E1/E2 live, plus overlap/DST logic.
- **Number-format propagation untested** (why D1 went unnoticed).
- SIP month-end/month-start convention unpinned; contextual-% unpinned; financial/health edge cases; World Clock thin (1 file).

### G. Process risk
- **[HIGH] The entire app is uncommitted.** One commit `896f40b feat: Initialize App`; everything else (all `frontend/`, all new backend `.py`, doctypes, tests, docs) is untracked/modified. No incremental history, not reviewable, not bisectable, high loss risk.
- **[MED] Playwright e2e not re-run** after PIN/IFSC/World Clock/Home additions. Green vitest+build don't cover those browser flows.

---

## 3. Open product decisions (need Vibhav — framed in product terms)

1. **SIP projection convention.** We compute SIP assuming each monthly investment is made at **month-end**. Every popular Indian SIP calculator (Groww, ClearTax, AMFI) assumes **month-start**, which yields a higher, "expected" number (~₹1,268 higher on a ₹10k/12%/1yr example, growing with tenor). Match the Indian convention (month-start), keep month-end with the assumption noted, or show both?
2. **Break-even revenue.** We round break-even *quantity* up to whole units, so "break-even revenue" reads slightly into profit. Keep (units can't be sold in fractions) or show the exact cost-recovery revenue?
3. **Calculator percentage.** `100 + 10%` currently = 100.1 (literal ÷100). Many everyday calculators treat it as "+10% of 100" = 110. Keep literal or adopt contextual %?
4. **Weather & Dictionary.** Confirmed placeholders. For V1: keep them clearly disabled (spec allows this), or do we want to validate a provider/dataset and build one/both now?
5. **BMI labels.** We show WHO "Class 1/2/3 obesity" but the stated source is CDC (which just says "Obesity"). Align labels to the stated source?

---

## 4. Prioritized plan (phased)

> Sequenced so the stated active priority (PIN/IFSC productionization) is unblocked early, with a git safety net first. Each phase is independently shippable. No code until you approve the phase.

### Phase 0 — Git safety net (do first, ~small)
- [ ] Commit the existing working tree in logical, reviewable batches (shell/registry; each tool; backend services; data/doctypes; tests; docs) with meaningful messages.
- [ ] Confirm `.gitignore` excludes build output / node_modules / datasets.
- **Why first:** everything below edits this tree; we want a clean baseline and recoverability before touching code.

### Phase 1 — PIN/IFSC release-safety fixes, THEN productionize (active priority)
- [ ] Fix **B-HIGH** reactivation bug — re-importing an identical/older checksum must be a true no-op, never demote a newer Active release.
- [ ] Fix **B-MED** failure durability — persist `Failed`/`failure_reason` in its own committed transaction (savepoint) so post-mortems survive.
- [ ] Split counts — separate excluded (invalid) vs duplicate vs incomplete (add doctype fields).
- [ ] Decide pruning policy for superseded rows (retain N, or prune on activation) — pick one and implement.
- [ ] Then the original import flow: copy CSVs from `/private/tmp/toolbox-business-dataset-review/` to durable storage → compute SHA-256 → import into `toolbox-test.localhost` → verify counts/exclusions/attribution → benchmark full-scale lookups → activate only after validation.
- [ ] Add release-import tests covering the reactivation no-op and count separation.

### Phase 2 — Systemic security hardening (spec §10.3) — DONE (commit `0657ee5`)
- [x] Add per-IP `@rate_limit` to all six `allow_guest` endpoints — PIN/IFSC search + dataset status 100/min, currency 60/min, HSN catalog 30/min, HSN dependency 20/min.
- [x] Replace `limit_page_length` → `limit` at `hsn_catalog.py:98` (only app usage; residual warnings are Frappe internals).
- [ ] _Deferred:_ `defusedxml` for ECB parsing (adds a dependency; ECB source is fixed/trusted — low risk).
- [ ] _Deferred:_ server-side cache for `get_hsn_catalog` full-scan (rate-limit + revision-gating already bound it); drop `site_name` from browser context (LOW).

### Phase 3 — Product-correctness & honest-data / UX consistency
- [x] **Show/hide tools** (commit `1b3276d`) — the main Settings-page ask; also gives users real nav-visibility control.
- [x] **Remove the reachable "Live" wording** (commit `b88e23c`) — cache statuses now map to compliant labels (live→updated); e2e guard added.
- [x] **Stop recording disabled tools in Recent** (commit `fda626d`).
- [ ] **PARKED — number-format (§7.6) propagation.** Audit over-stated it: **Unit-Converter is intentionally ungrouped** (editable fields need raw precision — explicit test `formatConvertedValue(1/3)==='0.333333333333'`); Calculator arguable. Only **GST** (hardcoded `en-IN`, `useGstCalculator.js:210`) and **Health** (browser-default `.toLocaleString()`, `catalog.js`) are clear — and GST is India-specific, so "international" grouping there is a product call. Needs Vibhav: which tools should honor the setting, and does GST's India-nature override it? Financial already does it right (`formatFinancialValue.js`) — reuse that pattern for whichever tools we choose.
- [ ] Remaining: unify tool-visibility so the live **India Business** tool is searchable (search filters `releaseStatus==='available'`, hiding it) without exposing Weather/Dictionary placeholders; decide `featureFlag` (wire or remove). Enforce PIN/IFSC honest labels client-side as a backstop.
- **Comprehensive Settings page (user request, 1 Aug 2026).** Expand `SettingsView.vue` beyond the current §7.6 number/locale controls:
  - [x] **Show / hide individual tools** — DONE (commit `1b3276d`). New "Sidebar tools" section; `hiddenToolIds` pref mirrors favourites (backward-compatible optional field + `setHidden` op); sidebar + its favourites list filter hidden tools; hidden tools stay reachable via All tools/search/URL. Gives users real nav-visibility control (addresses inert `featureFlag`). 437 FE + 15 pref tests green.
  - [ ] Explicit **light / dark / system theme** toggle — **FLAGGED: dark mode is NOT actually built** (no `darkMode` in tailwind, no `data-theme`/toggle, no dark tokens applied). This is an implement-dark-theme task (restyle + review every screen), deferred to its own phase per Vibhav.
  - Candidate additions to consider: default landing view / home tool, compact vs comfortable density, reduced-motion toggle (spec §7.7), "reset all preferences / clear local data", default calculator mode (deg/rad), and per-guest-vs-signed-in sync clarity.
  - Persist via the existing `ToolboxPreferencesStore` (guest local + authed semantic sync); add tests for theme + visibility propagation. Needs a mini-spec + design pass before coding.

### Phase 4 — Time-tool bug fixes
- [x] **Timer fixes** (commit `16b23af`) — persist countdown on start; persist DONE so the alarm fires once and never re-fires on reload; new composable tests (was zero-coverage).
- [x] **Guard working-hours range** (commit `3d416e7`) — End now derives from Start, so an unsatisfiable range can't be selected.
- [ ] **PARKED — DST label heuristic** for negative-DST zones (Europe/Dublin). Low value; needs zone-specific legal-standard-time logic. Accept + document, or defer.

### Phase 5 — Product decisions → implement (from §3 above, after you answer)

### Phase 6 — Test & release hardening
- [ ] Add absolute conversion vectors; cover `useTimerWorkspace`/`useWorldClock`; number-format propagation tests.
- [ ] Re-run full Playwright matrix; run Python suite on the test site.
- [ ] Accessibility pass (listbox arrow-key nav; verify §7.7 items).

### Phase 7 — Remaining V1 release-gate (§7 admin, docs)
- [ ] Admin controls: enable/disable tools, provider config, dataset version view + import trigger, locale/cache defaults (spec §6.3).
- [ ] Weather/Dictionary decision executed (build or clearly disable).
- [ ] Docs & attribution review; production install/upgrade test on a clean site.

---

## 5. Recommended immediate next step

**Phase 0 (git safety net) → then Phase 1's release-safety fixes**, because they directly unblock the PIN/IFSC import that was the stated active task and prevent the reactivation bug from corrupting a production activation. Everything else can follow in the order above or be re-prioritized.

---

## 6. Product decisions resolved (2026-08-03, autonomous session)

Vibhav delegated these ("take logical calls based on industry standard / best practices; I'll review"). Each was made to the mainstream default and is reviewable/reversible.

1. **SIP projection → month-start (annuity-due).** `calculateSip` now returns FV = P·((1+i)ⁿ−1)/i·(1+i). Matches every mainstream Indian SIP calculator (Groww, ClearTax, AMFI). UI description/formula/assumption updated; test vector recomputed (₹12,809.33 for ₹1,000 / 12% / 1yr). EMI (ordinary-annuity loan) and compound-interest deliberately unchanged.
2. **Calculator "100 + 10%" → kept literal (÷100).** This is an *expression* calculator (tokenizer→parser→evaluator with precedence and parentheses). Contextual "%" (Windows-calc style, =110) is ill-defined in an expression grammar — `+`/`−` would have to mean "percent of the left operand" while `*`/`÷` mean ÷100, breaking clean precedence and chained-percent cases. Literal postfix ÷100 is the consistent, standard choice for expression/scientific calculators. No change (reviewable — four-function contextual % would be a deliberate different design).
3. **Break-even → kept round-up; clarified.** Quantity rounds up to the next whole unit (a fraction can't be sold to reach break-even) and revenue uses that quantity; the assumption line now says so. Math unchanged.
4. **BMI labels → cite WHO and CDC.** Labels shown are "Healthy weight" (CDC's term) + "Class 1/2/3 obesity" (WHO's formal scheme, also published by CDC); both bodies use identical cutoffs. Citation changed from "Adult CDC categories" to "Adult WHO and CDC categories" so labels and source are consistent. Cutoffs unchanged; disclaimer preserved.
5. **Weather & Dictionary → kept disabled for V1.** The spec sanctions clearly-disabled conditional tools; shipping an unvalidated provider/dataset would violate the honest-data rule. They present an honest "Not enabled yet · provider required" state. Recommended sources when built: **Open-Meteo** (free, no key, CC-BY) for Weather; a public-domain dataset (Wiktionary / WordNet / GCIDE) for Dictionary. Deferred post-V1.
6. **PIN "source updated" date → kept 2026-06-10 (unconfirmed).** data.gov.in blocks automated reads; the file is verified-genuine and a web search corroborates the date. Correctable via re-import.
7. **PIN attribution URL → corrected** to `.../catalog/all-india-pincode-directory` (was the `-through-webservice` API endpoint; we imported a bulk CSV). Fixed in code (`PIN_SOURCE`) and on the active prod release.
8. **PIN city search → official-rename aliases added.** "Bangalore" and 18 other former names (Bombay, Calcutta, Madras, Poona, Gurgaon, Trivandrum, …) now resolve to the current names the dataset stores (Bengaluru, Mumbai, …). Deterministic map in `india_business.py`; verified live ("Bangalore" → Bengaluru results).

**Verification:** vitest 440, Python 31 unit + 22 integration, Playwright e2e 73 — all green; production build clean. Full desktop+mobile visual sweep of all 12 tools + Home/All-tools/Settings — no overflow/overlap/obscured-content issues (mobile `<main>` has `pb-20`, nav `h-16`).
