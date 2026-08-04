import { getToolboxSession } from './session'

// Toolbox is a single-owner, authenticated-only application. This router guard is
// defence-in-depth behind the server-side gate in toolbox/www/toolbox.py: if a session is
// lost mid-use, the next navigation sends the user to the Frappe login and returns them to
// the route they were on. Installed in main.js so router.js stays a pure route table.
export function buildLoginRedirect(fullPath, base = __FRONTEND_ROUTE__) {
  const target = `${base}${fullPath}`
  return `/login?redirect-to=${encodeURIComponent(target)}`
}

export function createAuthGuard({ session = globalThis, redirect = defaultRedirect } = {}) {
  return (to) => {
    if (getToolboxSession(session).isLoggedIn) return true
    redirect(buildLoginRedirect(to.fullPath))
    return false
  }
}

function defaultRedirect(url) {
  if (globalThis.location) globalThis.location.href = url
}
