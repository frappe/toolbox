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

const isOfflineFailure = (text) => OFFLINE_FAILURE_SIGNATURES.some((signature) => text.includes(signature))

export const test = base.extend({
  allowOfflineNetworkErrors: [false, { option: true }],
  allowFrappeLoginRedirectAbort: [false, { option: true }],
  page: async ({ page, allowOfflineNetworkErrors, allowFrappeLoginRedirectAbort }, use) => {
    const browserErrors = []

    page.on('pageerror', (error) => {
      // WebKit headless intermittently fails to register the service worker under parallel
      // load ("...toolbox-sw.js due to access control checks"). It registers fine in real
      // browsers and in isolation; treat this specific noise as non-fatal.
      const swRegistrationNoise =
        error.message.includes('toolbox-sw.js') && error.message.includes('access control')
      if (!swRegistrationNoise) browserErrors.push(`pageerror: ${error.message}`)
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
      const expectedRealtimeNoise = request.url().includes(':9000/socket.io/')
      const expectedLoginRedirectAbort =
        allowFrappeLoginRedirectAbort &&
        failure.includes('ERR_ABORTED') &&
        new URL(request.url()).pathname === '/desk'
      if (!expectedOfflineError && !expectedRealtimeNoise && !expectedLoginRedirectAbort) {
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
