import { expect, test } from './fixtures'

test('@smoke runs the timer, stopwatch laps, and date countdown', async ({ page }) => {
  await page.goto('/timer')
  await page.getByLabel('Minutes').fill('1')
  await page.getByRole('button', { name: 'Set timer' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Stopwatch' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lap', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Lap times' })).toContainText('Lap 1')

  await page.getByRole('radio', { name: 'Countdown' }).click()
  await page.getByLabel('Duration in minutes').fill('2')
  await page.getByRole('button', { name: 'Start countdown' }).click()
  await expect(page.getByText('Target:')).toBeVisible()
})
