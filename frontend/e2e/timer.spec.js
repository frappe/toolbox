import { expect, test } from './fixtures'

test('@smoke runs the timer, stopwatch laps, and date countdown', async ({ page }) => {
  await page.goto('/timer')
  const strip = page.getByRole('navigation', { name: 'Timekeeping tool' })
  await page.getByLabel('Minutes').fill('1')
  await page.getByRole('button', { name: 'Set timer' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await strip.getByRole('link', { name: 'Stopwatch' }).click()
  await expect(page).toHaveURL(/\/stopwatch$/)
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lap', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Lap times' })).toContainText('Lap 1')

  // The timer set above is still running. The three share one workspace, which is why they
  // share a view even though each has its own route.
  await strip.getByRole('link', { name: 'Timer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await strip.getByRole('link', { name: 'Countdown Timer' }).click()
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
  // These are links in a nav, not a radiogroup, so Enter activates them the way it activates
  // any link. An earlier attempt used frappe-ui TabButtons with a route per option; reka
  // handles Space itself and cancels Enter, so the strip was reachable by mouse alone.
  await page.goto('/timer')
  const stopwatch = page
    .getByRole('navigation', { name: 'Timekeeping tool' })
    .getByRole('link', { name: 'Stopwatch' })

  await stopwatch.focus()
  await stopwatch.press('Enter')

  await expect(page).toHaveURL(/\/stopwatch$/)
  await expect(page.getByRole('heading', { name: 'Stopwatch', level: 1 })).toBeVisible()
})

test('links between the three, rather than switching a tab', async ({ page }) => {
  // A tab has no URL. These are real anchors, so a crawler can follow them and a visitor can
  // open one in a new tab.
  await page.goto('/timer')
  const strip = page.getByRole('navigation', { name: 'Timekeeping tool' })
  await expect(strip.getByRole('link', { name: 'Stopwatch' })).toHaveAttribute(
    'href',
    '/stopwatch',
  )
  await expect(strip.getByRole('link', { name: 'Countdown Timer' })).toHaveAttribute(
    'href',
    '/countdown-timer',
  )
  // The page you are on is named, rather than left to colour alone.
  await expect(strip.getByRole('link', { name: 'Timer', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})
