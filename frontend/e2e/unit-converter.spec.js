import { expect, test } from './fixtures'

test('@smoke converts in both directions and swaps units', async ({ page }) => {
  await page.goto('/length-converter')

  const fromValue = page.getByRole('textbox', { name: 'From value' })
  const toValue = page.getByRole('textbox', { name: 'To value' })
  await fromValue.fill('1500')
  await expect(toValue).toHaveValue('1.5')
  await expect(page.getByTestId('conversion-announcement')).toContainText('kilometer')

  await toValue.fill('2')
  await expect(fromValue).toHaveValue('2000')

  await page.getByRole('button', { name: 'Swap units' }).click()
  await expect(page.getByRole('button', { name: /From unit Kilometer/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /To unit Meter/ })).toBeVisible()
})

test('@smoke gives each measurement its own page', async ({ page }) => {
  for (const [path, heading] of [
    ['/length-converter', 'Length Converter'],
    ['/weight-converter', 'Weight Converter'],
    ['/temperature-converter', 'Temperature Converter'],
    ['/data-storage-converter', 'Data Storage Converter'],
    ['/fuel-consumption-converter', 'Fuel Consumption Converter'],
  ]) {
    await page.goto(path)

    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
})

test('@smoke sends the retired converter route to length', async ({ request }) => {
  for (const source of ['/unit-converter', '/toolbox/unit-converter']) {
    const response = await request.get(source, { maxRedirects: 0 })

    expect(response.status(), source).toBe(308)
    expect(new URL(response.headers().location, 'http://x').pathname, source).toBe(
      '/length-converter',
    )
  }
})

test('carries the value already typed to the next measurement', async ({ page }) => {
  // The nine share a view because they share the conversion field, so a move keeps the value.
  await page.goto('/temperature-converter')
  await page.getByRole('textbox', { name: 'From value' }).fill('100')
  await expect(page.getByRole('textbox', { name: 'To value' })).toHaveValue('212')

  await page
    .getByRole('navigation', { name: 'Measurement category' })
    .getByRole('link', { name: 'Speed Converter' })
    .click()

  await expect(page).toHaveURL(/\/speed-converter$/)
  await expect(page.getByRole('heading', { name: 'Speed Converter', level: 1 })).toBeVisible()
})
