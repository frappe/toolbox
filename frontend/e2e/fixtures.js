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
//
// This is discounted everywhere rather than opted into per spec. It began as an option for the two
// specs that walk all 37 routes, and then a pre-existing spec that opens six calculators in a loop
// hit the same thing — as any spec that visits more than one page eventually will. An abort is the
// browser obeying a navigation, and no product defect shows up only as one. What the gate is for
// still works: a 4xx, a 5xx, a refused connection and a DNS failure all carry their own signature
// and all still fail.
//
// Firefox pairs the abort with a console error from the service worker, which is reporting the same
// cancelled fetch one layer up. That the worker itself works is proved by `offline.spec.js`, which
// asserts 27 routes actually load with the network off, rather than by the absence of noise here.
const NAVIGATION_ABORT_SIGNATURES = [
  'NS_BINDING_ABORTED',
  'NS_ERROR_ABORT',
  'ERR_ABORTED',
  'cancelled',
  'A ServiceWorker intercepted the request',
]

const matches = (signatures, text) => signatures.some((signature) => text.includes(signature))
const isOfflineFailure = (text) => matches(OFFLINE_FAILURE_SIGNATURES, text)
const isNavigationAbort = (text) => matches(NAVIGATION_ABORT_SIGNATURES, text)

export const test = base.extend({
  allowOfflineNetworkErrors: [false, { option: true }],
  page: async ({ page, allowOfflineNetworkErrors }, use) => {
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
      // The realtime endpoint answers 400 to a client Toolbox does not use. Locally it sits on
      // :9000; in production it is the same origin with no port, which is why this matched the
      // port and had to stop. `--target=prod` found that: two specs failed on a 400 the local run
      // had been discounting all along.
      //
      // Worth reading twice, because it is also the evidence in #266 that the unused socket.io
      // client is not a local artifact. The live site makes this failing request on every page.
      const expectedRealtimeNoise = response.status() === 400 && response.url().includes('/socket.io/')
      if (response.status() >= 400 && !expectedRealtimeNoise) {
        browserErrors.push(`http ${response.status()}: ${response.url()}`)
      }
    })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText || 'unknown failure'
      const expectedOfflineError = allowOfflineNetworkErrors && isOfflineFailure(failure)
      const expectedAbort = isNavigationAbort(failure)
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
      // The Content-Security-Policy is served report-only, and a report-only policy tells the
      // console what it *would* have blocked. That is the whole point of it, and `csp.spec.js` is
      // what asserts on those reports. Matching on "Report-Only" keeps this narrow: once the
      // policy enforces, its messages say "blocked" instead and land here as failures.
      const cspReport = text.includes('Content-Security-Policy') && /Report[- ]Only/i.test(text)
      const abortNoise = isNavigationAbort(text)
      if (
        message.type() === 'error' &&
        !expectedOfflineError &&
        !reportedByNetworkListener &&
        !expectedRealtimeNoise &&
        !cspReport &&
        !abortNoise
      ) {
        browserErrors.push(`console: ${text}`)
      }
    })

    await use(page)

    expect(browserErrors, 'The browser emitted unexpected errors.').toEqual([])
  },
})

export { expect }
