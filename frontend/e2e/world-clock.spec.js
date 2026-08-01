import { expect, test } from './fixtures'

test.use({ allowOfflineNetworkErrors: true })

test('@smoke adds, reorders, favourites, and removes a time zone', async ({ page }) => {
  await page.goto('/toolbox/world-clock')

  await expect(page.getByRole('heading', { name: 'World Clock', level: 1 })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Add a city or IANA time zone' }).fill('Tokyo')
  await page.getByRole('button', { name: /Tokyo.*Asia\/Tokyo/ }).click()

  const tokyo = page.getByRole('listitem').filter({ hasText: 'Asia/Tokyo' })
  await expect(tokyo).toBeVisible()
  const locationCount = await page.getByRole('listitem').count()
  await tokyo.getByRole('button', { name: 'Favourite Tokyo' }).click()
  await expect(tokyo.getByRole('button', { name: 'Unfavourite Tokyo' })).toBeVisible()

  await tokyo.getByRole('button', { name: 'Move Tokyo up' }).click()
  await expect(page.getByRole('listitem').nth(locationCount - 2)).toContainText('Asia/Tokyo')

  await tokyo.getByRole('button', { name: 'Remove Tokyo' }).click()
  await expect(tokyo).toHaveCount(0)
})

test('updates every location with the shared time slider and copies the meeting times', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/toolbox/world-clock')

  const kolkata = page.getByRole('listitem').filter({ hasText: 'Asia/Kolkata' })
  const initialTime = await kolkata.locator('p.font-mono').textContent()
  await page.getByRole('slider', { name: 'Selected time' }).fill('4')
  await expect(kolkata.locator('p.font-mono')).not.toHaveText(initialTime)

  await page.getByRole('button', { name: 'Copy meeting times' }).click()
  await expect(page.getByRole('status')).toContainText('Meeting times copied.')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Kolkata:')
})

test('launches directly and remains useful offline', async ({ context, page }) => {
  await page.goto('/toolbox/world-clock')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'World Clock', level: 1 })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Asia/Kolkata' })).toBeVisible()
    await page.getByRole('slider', { name: 'Selected time' }).fill('-3')
    await expect(page.getByText('3 hours', { exact: false })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
