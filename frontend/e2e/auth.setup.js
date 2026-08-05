import { test as setup } from '@playwright/test'

import { loginAsAdministrator } from './support/auth'

// Toolbox is authenticated-only, so every spec needs a signed-in session. This runs once (as a
// project dependency) and saves the session to a storage-state file the browser projects reuse,
// so individual specs never redirect to /login. Credentials come from TOOLBOX_E2E_USERNAME /
// TOOLBOX_E2E_PASSWORD (default Administrator / admin).
export const AUTH_FILE = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await loginAsAdministrator(page)
  await page.context().storageState({ path: AUTH_FILE })
})
