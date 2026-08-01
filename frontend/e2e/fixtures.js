import { expect, test as base } from '@playwright/test'

export const test = base.extend({
  allowOfflineNetworkErrors: [false, { option: true }],
  allowFrappeLoginRedirectAbort: [false, { option: true }],
  page: async ({ page, allowOfflineNetworkErrors, allowFrappeLoginRedirectAbort }, use) => {
    const browserErrors = []

    page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))
    page.on('response', (response) => {
      const expectedRealtimeNoise =
        response.status() === 400 && response.url().includes(':9000/socket.io/')
      if (response.status() >= 400 && !expectedRealtimeNoise) {
        browserErrors.push(`http ${response.status()}: ${response.url()}`)
      }
    })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText || 'unknown failure'
      const expectedOfflineError =
        allowOfflineNetworkErrors && failure.includes('ERR_INTERNET_DISCONNECTED')
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
      const expectedOfflineError =
        allowOfflineNetworkErrors && text.includes('net::ERR_INTERNET_DISCONNECTED')
      const reportedByNetworkListener = text.startsWith('Failed to load resource:')
      if (message.type() === 'error' && !expectedOfflineError && !reportedByNetworkListener) {
        browserErrors.push(`console: ${text}`)
      }
    })

    await use(page)

    expect(browserErrors, 'The browser emitted unexpected errors.').toEqual([])
  },
})

export { expect }
