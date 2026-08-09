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
