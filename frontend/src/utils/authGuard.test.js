import { describe, expect, it, vi } from 'vitest'

import { buildLoginRedirect, createAuthGuard } from './authGuard'

describe('authGuard', () => {
  it('builds a login redirect that returns to the intended toolbox route', () => {
    expect(buildLoginRedirect('/calculator', '/toolbox')).toBe(
      '/login?redirect-to=%2Ftoolbox%2Fcalculator',
    )
  })

  it('allows navigation for an authenticated session', () => {
    const redirect = vi.fn()
    const guard = createAuthGuard({
      session: { is_logged_in: true, user: 'person@example.com' },
      redirect,
    })

    expect(guard({ fullPath: '/calculator' })).toBe(true)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects an explicitly signed-out session to login and blocks navigation', () => {
    const redirect = vi.fn()
    const guard = createAuthGuard({
      session: { is_logged_in: false, user: 'Guest' },
      redirect,
    })

    expect(guard({ fullPath: '/settings' })).toBe(false)
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/login?redirect-to='))
  })

  it('allows navigation on the boot-less offline shell instead of bouncing to login', () => {
    const redirect = vi.fn()
    // The cached offline shell carries no Frappe boot data, so is_logged_in is undefined.
    const guard = createAuthGuard({ session: {}, redirect })

    expect(guard({ fullPath: '/calculator' })).toBe(true)
    expect(redirect).not.toHaveBeenCalled()
  })
})
