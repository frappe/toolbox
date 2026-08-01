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

### Phase 2 — Systemic security hardening (spec §10.3)
- [ ] Add `@frappe.rate_limit` to all `allow_guest` endpoints (currency, HSN catalog+dependency, PIN/IFSC search).
- [ ] Add a server-side cache for `get_hsn_catalog` full-scan (or gate behind revision) to kill the amplification.
- [ ] Replace `limit_page_length` → `limit` at `hsn_catalog.py:98`.
- [ ] Swap ECB XML parse to `defusedxml`; drop `site_name` from browser context.

### Phase 3 — Product-correctness & honest-data / UX consistency
- [ ] Make all tools consume the §7.6 number-format + precision setting (GST, Health, Calculator, Unit Converter) + a propagation test.
- [ ] Remove the reachable "Live" wording; standardize on reference-rate language.
- [ ] Unify tool-visibility policy across router/sidebar/search; wire `featureFlag` to actually gate (or remove the field if we standardize on `releaseStatus`); badge validating tools in the sidebar; stop recording disabled tools in Recent.
- [ ] Enforce PIN/IFSC honest labels client-side as a backstop.

### Phase 4 — Time-tool bug fixes
- [ ] Persist countdown on start; persist DONE so the alarm fires once and never re-fires on reload; add composable tests.
- [ ] Guard working-hours range (start<end / overnight); improve DST label (or accept + document the heuristic).

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
