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

Run every desktop, mobile, offline, authenticated, and accessibility scenario:

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
