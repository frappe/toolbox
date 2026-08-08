import { expect, test } from './fixtures'

test('@smoke calculates BMI, BMR, maintenance calories, and pace', async ({ page }) => {
  await page.goto('/toolbox/health-calculators')
  const result = page.getByRole('region', { name: 'Result' })
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('22.9')
  await expect(result).toContainText('Healthy weight')

  await page.getByRole('radio', { name: 'BMR' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('1,649 kcal/day')
  await expect(result).toContainText('Mifflin–St Jeor')

  await page.getByRole('radio', { name: 'Calories' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('2,556 kcal/day')
  await expect(result).toContainText('Moderately active × 1.55')

  await page.getByRole('radio', { name: 'Pace' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('06:00 per km')
})

test('keeps equivalent metric and imperial BMI estimates', async ({ page }) => {
  await page.goto('/toolbox/health-calculators')
  const output = page.getByRole('status', { name: 'Primary health result' })
  const metricBmi = await output.textContent()
  // frappe-ui Select is a reka listbox, not a native <select>.
  await page.getByLabel('Units').click()
  await page.getByRole('option', { name: 'Imperial' }).click()
  await expect(output).toHaveText(metricBmi)
  await expect(page.getByText('Inputs stay in this browser tab and are not saved.')).toBeVisible()
})

test('calculates each missing pace value and validates clock input', async ({ page }) => {
  await page.goto('/toolbox/health-calculators')
  await page.getByRole('radio', { name: 'Pace' }).click()
  await page.locator('#pace-solveFor').click()
  await page.getByRole('option', { name: 'Distance' }).click()
  await page.locator('#pace-duration').fill('1:00:00')
  await page.locator('#pace-pace').fill('05:00')
  await expect(page.getByRole('status', { name: 'Primary health result' })).toHaveText('12.00 km')
  await page.locator('#pace-pace').fill('05:99')
  await expect(page.getByRole('alert')).toContainText('minutes and seconds must be below 60')
})
