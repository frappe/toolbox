import { expect, test } from './fixtures'

test('@smoke runs the timer, stopwatch laps, and date countdown', async ({ page }) => {
  await page.goto('/timer')
  const sidebar = page.getByRole('navigation', { name: 'Toolbox navigation' })
  await page.getByLabel('Minutes').fill('1')
  await page.getByRole('button', { name: 'Set timer' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await sidebar.getByRole('link', { name: 'Stopwatch' }).click()
  await expect(page).toHaveURL(/\/stopwatch$/)
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lap', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Lap times' })).toContainText('Lap 1')

  // The timer set above is still running. The three share one workspace, which is why they
  // share a view even though each has its own route.
  await sidebar.getByRole('link', { name: 'Timer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await sidebar.getByRole('link', { name: 'Countdown Timer' }).click()
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

test('opens a sibling from the keyboard', async ({ page }) => {
  // The sidebar holds links in a nav, so Enter activates one the way it activates any link.
  await page.goto('/timer')
  const stopwatch = page
    .getByRole('navigation', { name: 'Toolbox navigation' })
    .getByRole('link', { name: 'Stopwatch' })

  await stopwatch.focus()
  await stopwatch.press('Enter')

  await expect(page).toHaveURL(/\/stopwatch$/)
  await expect(page.getByRole('heading', { name: 'Stopwatch', level: 1 })).toBeVisible()
})

test('offers the family in the sidebar and nowhere else', async ({ page }) => {
  // One item in the sidebar is one page. The page used to repeat the family as a strip of tabs
  // above the tool, which listed the same three tools the sidebar already listed.
  await page.goto('/timer')
  const sidebar = page.getByRole('navigation', { name: 'Toolbox navigation' })

  await expect(page.getByRole('navigation', { name: 'Timekeeping tool' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Stopwatch' })).toHaveCount(1)
  await expect(sidebar.getByRole('link', { name: 'Countdown Timer' })).toHaveCount(1)
})
