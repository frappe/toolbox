import { expect, test as base } from '@playwright/test'

// Going offline surfaces different failure strings per engine: Chromium disconnects requests,
// Firefox reports NS_ERROR_OFFLINE and aborts in-flight ones with NS_BINDING_ABORTED. All are
// expected once the app runs from its cache with no network.
const OFFLINE_FAILURE_SIGNATURES = [
  'ERR_INTERNET_DISCONNECTED',
  'NS_ERROR_OFFLINE',
  'NS_BINDING_ABORTED',
  'A ServiceWorker intercepted the request',
]

// Leaving a page cancels whatever it had in flight: a lazy route chunk, a dataset call. Firefox
// reports that as NS_BINDING_ABORTED and WebKit as "cancelled", while Chromium says nothing.
// It is the browser doing as it was told, not the application failing, and only a spec that walks
// every route in turn produces enough of it to matter.
const NAVIGATION_ABORT_SIGNATURES = ['NS_BINDING_ABORTED', 'NS_ERROR_ABORT', 'ERR_ABORTED', 'cancelled']

const matches = (signatures, text) => signatures.some((signature) => text.includes(signature))
const isOfflineFailure = (text) => matches(OFFLINE_FAILURE_SIGNATURES, text)

export const test = base.extend({
  allowOfflineNetworkErrors: [false, { option: true }],
  // Opt in from a spec that navigates repeatedly. Do not set it on an ordinary spec: it would
  // hide a request that failed for a reason of its own.
  allowNavigationAbortErrors: [false, { option: true }],
  page: async ({ page, allowOfflineNetworkErrors, allowNavigationAbortErrors }, use) => {
    const browserErrors = []

    page.on('pageerror', (error) => {
      // WebKit headless intermittently fails to register the service worker under parallel
      // load ("...toolbox-sw.js due to access control checks"). It registers fine in real
      // browsers and in isolation; treat this specific noise as non-fatal.
      const swRegistrationNoise =
        error.message.includes('toolbox-sw.js') && error.message.includes('access control')
      // The cross-origin Frappe realtime attempt on :9000. The other three listeners below
      // already discount it; WebKit is the one engine that also raises it as a page error, and a
      // spec that opens every route in turn collects enough of them to fail on environment noise.
      const realtimeNoise = error.message.includes('/socket.io/')
      if (!swRegistrationNoise && !realtimeNoise) browserErrors.push(`pageerror: ${error.message}`)
    })
    page.on('response', (response) => {
      const expectedRealtimeNoise =
        response.status() === 400 && response.url().includes(':9000/socket.io/')
      if (response.status() >= 400 && !expectedRealtimeNoise) {
        browserErrors.push(`http ${response.status()}: ${response.url()}`)
      }
    })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText || 'unknown failure'
      const expectedOfflineError = allowOfflineNetworkErrors && isOfflineFailure(failure)
      const expectedAbort =
        allowNavigationAbortErrors && matches(NAVIGATION_ABORT_SIGNATURES, failure)
      const expectedRealtimeNoise = request.url().includes(':9000/socket.io/')
      if (!expectedOfflineError && !expectedAbort && !expectedRealtimeNoise) {
        browserErrors.push(`request failed: ${request.url()} (${failure})`)
      }
    })
    page.on('console', (message) => {
      const text = message.text()
      const expectedOfflineError = allowOfflineNetworkErrors && isOfflineFailure(text)
      const reportedByNetworkListener = text.startsWith('Failed to load resource:')
      // Firefox and WebKit log the cross-origin Frappe realtime attempt (socket.io on :9000)
      // as a console error; Toolbox does not use realtime, so it is environment noise.
      const expectedRealtimeNoise = text.includes('/socket.io/')
      if (
        message.type() === 'error' &&
        !expectedOfflineError &&
        !reportedByNetworkListener &&
        !expectedRealtimeNoise
      ) {
        browserErrors.push(`console: ${text}`)
      }
    })

    await use(page)

    expect(browserErrors, 'The browser emitted unexpected errors.').toEqual([])
  },
})

export { expect }
