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
    // The offline cached shell is the built index.html, served without Frappe boot data,
    // so is_logged_in is absent (undefined) rather than false. The server gate only ever
    // renders this app to a signed-in user, so "no boot data" means the browser is offline
    // on that cached shell — let the client-side tools run instead of bouncing to a /login
    // page the network cannot reach. A real signed-out session (boot present, is_logged_in
    // === false) still goes to login. navigator.onLine is not used: a freshly reloaded
    // document reports online before the offline state propagates, so it fires too early.
    if (session?.is_logged_in === undefined) return true
    redirect(buildLoginRedirect(to.fullPath))
    return false
  }
}

function defaultRedirect(url) {
  if (globalThis.location) globalThis.location.href = url
}
