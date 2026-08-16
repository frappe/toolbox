# The Toolbox QA suite

One command runs every check and writes one report.

```bash
bash qa/run-qa.sh
```

`.claude/skills/qa/` holds the same instructions for an agent, so "run the QA suite" works in
any session on any checkout. It lives in the repository rather than on one machine, for the same
reason this file does.

The report opens with a table of all 34 tools and a pass or fail for each, so the first question a
release asks — does every tool still work — is answered on the first screen.

## Running it

| Command | What it does | About |
| --- | --- | --- |
| `bash qa/run-qa.sh` | Every layer | about 11 min |
| `bash qa/run-qa.sh --fast` | Build, units, smoke browser | about 2 min |
| `bash qa/run-qa.sh --layer=browser` | One layer, named below | varies |
| `bash qa/run-qa.sh --target=prod` | The read-only layers against `frappe.tools` | 5 min |
| `bash qa/run-qa.sh --update-visual` | Re-record the reference images | 2 min |
| `bash qa/run-qa.sh --update-baseline` | Record the numbers from a full run that passed | — |

Layer names: `static`, `units`, `backend`, `browser`, `performance`, `security`, `lighthouse`.

The script starts the bench itself and stops it again. Do not start one first.

**Run it on its own.** A second Playwright run, or a build beside it, starves the single web server,
and every spec then fails on a 30-second navigation timeout that reads exactly like a real
regression. The script refuses to start when it finds another run, and the report says so when a
run's failures all sit at the timeout.

## On a pull request

`.github/workflows/ci.yml` runs three checks on every pull request into `develop`.

| Check | What it runs |
| --- | --- |
| Frontend build & tests | `yarn test`, then `yarn build` |
| Server tests | `bench --site test_site.localhost run-tests --app toolbox` |
| E2E (Playwright) | The browser matrix, on a bench it builds from scratch |

CI does not call `run-qa.sh`. The runner starts and stops its own bench, and CI already has one, so
the workflow runs the same layers directly.

Two differences from a local run, both deliberate:

- **The visual project does not run.** A reference image records one renderer on one operating
  system, and the committed set was recorded on macOS. A Linux runner would look for images that do
  not exist and fail on all 148. To add it, run the E2E job once with `--update-snapshots`, download
  the artifact, and commit the Linux images beside the macOS ones.
- **Paint timing is measured but not enforced.** A shared runner measures the runner. Layout
  stability is enforced everywhere, because it is a property of the page.

The E2E job imports the four datasets in the foreground rather than waiting for the queued sync, and
fails the job when any one of them does not import. The API contract tests read real rows.

## What each layer checks

**Static.** The production build, then Ruff's linter and formatter. ESLint is not run: the
repository `.eslintrc` is the Frappe desk boilerplate, with no Vue parser and `no-unused-vars`
turned off, so it rejects almost nothing the build accepts. Semgrep covers JavaScript and Vue in
the security layer instead.

**Backend.** `bench run-tests --app toolbox`.

**Units.** The vitest suite, with line coverage recorded so a drop fails the run.

**Browser.** The whole Playwright matrix, once, across Chromium, Firefox, WebKit, a Pixel 7 and the
visual project. It holds:

- *Correctness* — every tool, driven through the rendered page. See below.
- *Accessibility* — axe on all 37 routes, in light and in dark.
- *Mobile fit* — all 37 routes at phone width, measured on the element that actually scrolls.
- *Visual* — a reference image per route per theme per width, 148 in all.
- *Offline* — every tool that declares `offlineCapability: 'full'` in the registry.
- *Navigation* — the sitemap, the redirects, unique metadata, and no broken internal link.
- *Storage* — no persistent key beyond the three agreed, and no write to the server.
- *API contracts* — the eleven public endpoints over HTTP, against the real releases.
- *Security over HTTP* — write verbs, Frappe's own endpoints, injection payloads, rate limits.
- *Core Web Vitals* — paint and layout stability against a budget.

**Performance.** Gzipped bundle size, time to first byte per route, and lookup latency with ten
requests in flight.

**Security.** `yarn audit`, `pip-audit` and semgrep, through `uvx`, so nothing is installed into the
bench environment.

**Lighthouse.** Performance, accessibility, best practices and SEO on five representative routes.

## The correctness matrix

`frontend/src/test/toolCases/` holds what each tool should answer. `frontend/e2e/correctness.spec.js`
types it in and reads the screen.

Every expected figure comes from outside the application. The money was computed with Decimal in
Python from the published formula, the conversion factors are the defining SI and NIST values, the
transliterations were written from the Sanskrit, and the dataset rows come from the Department of
Posts, the RBI reference list, the CBIC classification and WordNet 3.1. Comparing a tool against its
own engine would prove only that the engine agrees with itself.

Add a tool, and add its cases here. A tool with no case is printed in the report as a gap, not as a
pass.

## What it does not check

The audio tools are checked for what they render, not for what they record. A headless browser
cannot prove a clip sounds right. The arithmetic underneath them — `wavEncode`, `audioEdit`,
`audioFormat`, `recorderPresets`, `fileSink` — is covered by unit tests in the units layer.

The response headers that limit framing and MIME sniffing come from the Frappe Cloud proxy rather
than from the application, so the local server answers without them. That check runs only under
`--target=prod`.

Reference images are the viewport, not the whole page. The written content below each tool is
covered by the content tests rather than by an image.

## Regressions the tests cannot see

`qa/baseline.json` holds the numbers from the last full run that passed: test counts, coverage,
bundle size, latency and Lighthouse scores. Every run compares against it and fails on a drop, even
when every test passes. A deleted test lowers the count and nothing else notices.

Update it with `--update-baseline`, which only writes after a full run that passed.

## Reference images

They live in `frontend/e2e/visual.spec.js-snapshots/` and are committed, about 8 MB. Re-record them
with `--update-visual` after an intended design change, and read the report first: it names every
image that moved.
