import { expect, test } from './fixtures'

test('@smoke runs the timer, stopwatch laps, and date countdown', async ({ page }) => {
  await page.goto('/timer')
  await page.getByLabel('Minutes').fill('1')
  await page.getByRole('button', { name: 'Set timer' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Stopwatch' }).click()
  await expect(page).toHaveURL(/\/stopwatch$/)
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lap', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Lap times' })).toContainText('Lap 1')

  // The timer set above is still running. The three share one workspace, which is why they
  // share a view even though each has its own route.
  await page.getByRole('radio', { name: 'Timer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Countdown Timer' }).click()
  await expect(page).toHaveURL(/\/countdown-timer$/)
  await page.getByLabel('Duration in minutes').fill('2')
  await page.getByRole('button', { name: 'Start countdown' }).click()
  await expect(page.getByText('Target:')).toBeVisible()
})

test('@smoke gives each timekeeping tool its own page', async ({ page }) => {
  for (const [path, heading] of [
    ['/timer', 'Timer'],
    ['/stopwatch', 'Stopwatch'],
    ['/countdown-timer', 'Countdown Timer'],
  ]) {
    await page.goto(path)

    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
})

test('links between the three, rather than switching a tab', async ({ page }) => {
  // A tab has no URL. These are real anchors, so a crawler can follow them and a visitor can
  // open one in a new tab.
  await page.goto('/timer')

  const strip = page.getByLabel('Timekeeping tool')
  await expect(strip.getByRole('radio', { name: 'Stopwatch' })).toHaveAttribute(
    'href',
    '/stopwatch',
  )
  await expect(strip.getByRole('radio', { name: 'Countdown Timer' })).toHaveAttribute(
    'href',
    '/countdown-timer',
  )
})
