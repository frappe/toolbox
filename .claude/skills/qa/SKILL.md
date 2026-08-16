---
name: qa
description: Run the full Toolbox QA suite and report what it found. Use when asked to "run the test suite", "run QA", "test everything", "check for regressions", or before a release of the Toolbox app.
---

# Toolbox QA

One command runs every check and writes one report.

## Run it

```bash
bash qa/run-qa.sh
```

Run it from the app root, the directory holding `qa/`.

Takes about 11 minutes. Use `--fast` for a 3-minute gate when the question is only "did I break
something obvious".

**The script starts the bench itself and stops it again.** Do not start one first, and do not wrap
it in another command that starts one.

**It must run alone.** Before starting, check `ListAgents` for a peer session and tell it you are
taking the machine. A second Playwright run, or a build beside this one, starves the single web
server and every spec then fails on a 30-second navigation timeout that reads exactly like a real
regression. The script refuses to start if it finds another run.

The bench cannot survive its own tool call, which is why everything is inside this one script.
Do not try to start the bench in a separate call.

## Read the result

The script prints the head of the report and the path to the rest.

```
qa/reports/<timestamp>/report.md     the whole thing
qa/reports/<timestamp>/report.html   the same, as a page
qa/reports/<timestamp>/report.json   the same, for a machine
```

Report to the user in this order:

1. The verdict, and the tools table if any tool failed.
2. Regressions against the baseline. These fail the run even when every test passed, and they are
   the ones nobody else would catch: a dropped test count means a test was deleted.
3. The failures themselves, with the layer each came from.
4. The notes. Skipped checks live here, and a skipped check is a gap, not a pass.

## Before believing a failure

A real failure finishes fast. A starved one sits at the 30-second test timeout, and the report says
so in its notes when it sees that pattern. Check the duration before diagnosing.

Two layers need something the local machine may not have. Semgrep fetches its rules over the
network, and the response-header check only means anything against production. Both report as
skipped rather than passing quietly.

## Other flags

| Flag | Use |
| --- | --- |
| `--fast` | Build, units and the smoke browser tests |
| `--layer=<name>` | One of `static`, `units`, `backend`, `browser`, `performance`, `security`, `lighthouse` |
| `--target=prod` | The read-only layers against `frappe.tools`. No build, no bench |
| `--update-visual` | Re-record the 148 reference images after an intended design change |
| `--update-baseline` | Record the numbers. Only writes after a full run that passed |

## When a change is intended

A design change moves reference images and a new tool moves the counts. Neither is a defect, and
neither should be waved through:

1. Read the report and name every image that moved, and check each one is the change that was
   wanted.
2. Re-record with `--update-visual`.
3. Re-run in full, then `--update-baseline`.

## On a pull request

Three checks run from `.github/workflows/ci.yml`: frontend build and unit tests, server tests, and
the browser matrix. They do not call this runner — CI already has a bench, and the runner starts its
own. The visual project does not run in CI, because its reference images were recorded on macOS.

So a green PR is not the same as a green `run-qa.sh`. Run the suite locally before a release.

## Adding a tool

`qa/README.md`, beside this skill in the repository, explains the layout. The short version: the route lists are derived from
`frontend/src/data/toolRegistry.js`, so a new tool enters the accessibility, mobile, visual and
navigation sweeps by itself. What it does not get by itself is a correctness case. Write one in
`frontend/src/test/toolCases/`, with the expected value taken from outside the application, or the
report will print the tool as a gap.
