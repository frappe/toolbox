# Toolbox end-to-end tests

The browser suite runs against the isolated Frappe test site by default:

```text
http://toolbox-test.localhost:8100
```

Keep the bench running before executing the suite. Install the browser runtime once with:

```bash
yarn playwright install chromium
```

Run the fast smoke gate:

```bash
yarn test:e2e:smoke
```

Run every desktop, mobile, offline, and accessibility scenario:

```bash
yarn test:e2e
```

Use `TOOLBOX_E2E_BASE_URL` to override the local default. Toolbox has no accounts, so the suite signs in to nothing and every browser context starts empty. Failed tests retain a screenshot, video, and Playwright trace under `test-results/e2e`.

## Scope a text lookup to the tool

Every tool page now carries an explanation below the tool: how the calculation is done, worked
examples and questions, written in `toolbox/content`. That text uses the same words the interface
uses, because it describes the interface.

So a page-wide `getByText` can match twice. Scope the lookup to the element that holds the state
you are asserting, and keep `getByRole` calls inside the region they belong to. The same rule
already applies to a tool name, which is a link in the sidebar and in the family strip.

## An offline reload on Firefox needs no `page.route` handler installed

Firefox answers `NS_ERROR_OFFLINE` and fails the navigation itself, before the service worker is
asked for the page, **but only while a `page.route` handler is installed**. Measured on one route
with nothing else changed: with a handler the reload fails every run, without one it succeeds
every run. Chromium serves the reload from the cached shell either way.

That is what made issue #214 look like a browser mystery. The currency test unrouted the rate API
and kept its reload, and it passed until the rate fixture began mocking the history API as well:
one handler stayed installed, and interception with it.

So a test that goes offline either unroutes every pattern it installed, or does not reload. Not
reloading is the sturdier of the two, because the next fixture that adds a handler cannot break
it. Move inside the loaded application instead, by clicking a link in the sidebar. A view reads
its stored state when it mounts, so an in-app navigation away and back exercises the same code,
and the route chunk it loads still has to come from the worker. Note that the sidebar opens the
category of the tool being shown, so the link has to be one in that category.
