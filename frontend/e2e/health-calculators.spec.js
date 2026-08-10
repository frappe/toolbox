import { expect, test } from './fixtures'

test('@smoke calculates BMI, BMR, maintenance calories, and pace', async ({ page }) => {
  await page.goto('/bmi-calculator')
  const result = page.getByRole('region', { name: 'Result' })
  const strip = page.getByRole('navigation', { name: 'Health calculator' })
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('22.9')
  await expect(result).toContainText('Healthy weight')

  await strip.getByRole('link', { name: 'BMR Calculator' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('1,649 kcal/day')
  await expect(result).toContainText('Mifflin–St Jeor')

  await strip.getByRole('link', { name: 'TDEE Calculator' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('2,556 kcal/day')
  await expect(result).toContainText('Moderately active × 1.55')

  await strip.getByRole('link', { name: 'Pace Calculator' }).click()
  await expect(result.getByRole('status', { name: 'Primary health result' })).toHaveText('06:00 per km')

  await expect(page).toHaveURL(/\/pace-calculator$/)
})

test('carries the body measurements from one calculator to the next', async ({ page }) => {
  // This is why the four share a view even though each has its own route. The comment here used to
  // claim it while the test asserted only the URL, and the measurements did not carry at all.
  await page.goto('/bmi-calculator')
  const strip = page.getByRole('navigation', { name: 'Health calculator' })
  await page.getByLabel('Height').fill('180')
  await page.getByLabel('Weight').fill('82')

  await strip.getByRole('link', { name: 'BMR Calculator' }).click()
  await expect(page.getByLabel('Height')).toHaveValue('180')
  await expect(page.getByLabel('Weight')).toHaveValue('82')

  await page.getByLabel('Age').fill('41')
  await strip.getByRole('link', { name: 'TDEE Calculator' }).click()
  await expect(page.getByLabel('Age')).toHaveValue('41')
  await expect(page.getByLabel('Height')).toHaveValue('180')
})

test('@smoke gives each health calculator its own page', async ({ page }) => {
  for (const [path, heading] of [
    ['/bmi-calculator', 'BMI Calculator'],
    ['/bmr-calculator', 'BMR Calculator'],
    ['/tdee-calculator', 'TDEE Calculator'],
    ['/pace-calculator', 'Pace Calculator'],
  ]) {
    await page.goto(path)

    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
})

test('@smoke sends the retired calculators route to BMI', async ({ request }) => {
  for (const source of ['/health-calculators', '/toolbox/health-calculators']) {
    const response = await request.get(source, { maxRedirects: 0 })

    expect(response.status(), source).toBe(308)
    expect(new URL(response.headers().location, 'http://x').pathname, source).toBe('/bmi-calculator')
  }
})

test('keeps equivalent metric and imperial BMI estimates', async ({ page }) => {
  await page.goto('/bmi-calculator')
  const output = page.getByRole('status', { name: 'Primary health result' })
  const metricBmi = await output.textContent()
  // frappe-ui Select is a reka listbox, not a native <select>.
  await page.getByLabel('Units').click()
  await page.getByRole('option', { name: 'Imperial' }).click()
  await expect(output).toHaveText(metricBmi)
  await expect(page.getByText('Inputs stay in this browser tab and are not saved.')).toBeVisible()
})

test('calculates each missing pace value and validates clock input', async ({ page }) => {
  await page.goto('/pace-calculator')
  await page.locator('#pace-solveFor').click()
  await page.getByRole('option', { name: 'Distance' }).click()
  await page.locator('#pace-duration').fill('1:00:00')
  await page.locator('#pace-pace').fill('05:00')
  await expect(page.getByRole('status', { name: 'Primary health result' })).toHaveText('12.00 km')
  await page.locator('#pace-pace').fill('05:99')
  await expect(page.getByRole('alert')).toContainText('minutes and seconds must be below 60')
})
