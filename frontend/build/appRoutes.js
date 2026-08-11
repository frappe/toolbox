// Every route the application serves, in one place on the JavaScript side.
//
// Two build steps need it and neither should own it: the service worker claims an exact route set,
// and the content build rejects a link that points at a route nobody serves. `toolbox/routes.py`
// holds the same list for Frappe, and `frontend/src/data/appRoutes.test.js` fails when the two
// disagree.

// The pages that are not tools. `all-tools` is absent on purpose: the root is that page.
export const APP_PAGES = ['/', '/about', '/data-sources', '/settings']

export async function appRoutes() {
  const { tools } = await import('../src/data/toolRegistry.js')
  return [...APP_PAGES, ...tools.map((tool) => tool.route)]
}
