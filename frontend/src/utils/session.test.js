import { describe, expect, it, vi } from 'vitest'

import { getToolboxSession, logoutToolbox, sessionInitials } from './session'

describe('getToolboxSession', () => {
  it('reads a signed-in user from injected boot values', () => {
    const session = getToolboxSession({ is_logged_in: true, user: 'ada@example.com', full_name: 'Ada Lovelace' })
    expect(session).toEqual({ user: 'ada@example.com', isLoggedIn: true, fullName: 'Ada Lovelace' })
  })

  it('falls back to the user id when no full name is provided', () => {
    const session = getToolboxSession({ is_logged_in: true, user: 'ada@example.com', full_name: '' })
    expect(session.fullName).toBe('ada@example.com')
  })

  it('treats a missing or guest session as not signed in', () => {
    expect(getToolboxSession({})).toEqual({ user: 'Guest', isLoggedIn: false, fullName: 'Guest' })
    expect(getToolboxSession({ is_logged_in: false, user: 'Guest' }).isLoggedIn).toBe(false)
  })
})

describe('sessionInitials', () => {
  it('derives initials from a full name', () => {
    expect(sessionInitials({ fullName: 'Ada Lovelace' })).toBe('AL')
  })

  it('derives initials from an email local part when there is no name', () => {
    expect(sessionInitials({ user: 'ada.lovelace@example.com' })).toBe('AL')
    expect(sessionInitials({ user: 'ada@example.com' })).toBe('AD')
  })

  it('returns a placeholder for an empty session', () => {
    expect(sessionInitials({})).toBe('?')
  })
})

describe('logoutToolbox', () => {
  it('calls the logout endpoint and then redirects to login', async () => {
    const request = vi.fn().mockResolvedValue({})
    const redirect = vi.fn()
    await logoutToolbox({ request, redirect })

    expect(request).toHaveBeenCalledWith({ url: '/api/method/logout', method: 'POST' })
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('still redirects when the logout request fails', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const redirect = vi.fn()
    await logoutToolbox({ request, redirect })

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
