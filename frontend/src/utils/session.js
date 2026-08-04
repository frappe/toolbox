import { frappeRequest } from 'frappe-ui'

// The Frappe web entry (toolbox.py) injects these boot values onto `window`.
// Read them defensively so the shell renders for guests and in tests too.
export function getToolboxSession(source = globalThis) {
  const user = typeof source?.user === 'string' && source.user ? source.user : 'Guest'
  const isLoggedIn = source?.is_logged_in === true && user !== 'Guest'
  const rawName = typeof source?.full_name === 'string' ? source.full_name.trim() : ''
  const fullName = rawName || (isLoggedIn ? user : 'Guest')

  return { user, isLoggedIn, fullName }
}

// A short, stable set of initials for the account avatar.
export function sessionInitials(session) {
  const source = session?.fullName || session?.user || ''
  const words = source.replace(/@.*$/, '').split(/[\s._-]+/u).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words.at(-1)[0]
  return letters.toUpperCase()
}

// Log the current user out through Frappe, then return to the login page. Best-effort:
// a failed request still redirects so the user is never stranded on a half-signed-out shell.
export async function logoutToolbox({ request = frappeRequest, redirect = defaultRedirect } = {}) {
  try {
    await request({ url: '/api/method/logout', method: 'POST' })
  } catch {
    // Ignore: the redirect below still lands the user on a clean login page.
  }
  redirect('/login')
}

function defaultRedirect(path) {
  if (globalThis.location) globalThis.location.href = path
}
