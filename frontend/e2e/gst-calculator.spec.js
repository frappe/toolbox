import { expect, test } from './fixtures'

test('@smoke adds, removes, and splits GST', async ({ page }) => {
  await page.goto('/toolbox/gst-calculator')

  await page.getByRole('textbox', { name: 'Base amount' }).fill('1000')
  const results = page.getByRole('region', { name: 'Result' })
  await expect(results).toContainText('₹1,180.00')
  await expect(results.locator('dl > div').filter({ hasText: 'CGST' })).toContainText('₹90.00')
  await expect(results.locator('dl > div').filter({ hasText: 'SGST' })).toContainText('₹90.00')

  await page.getByRole('button', { name: 'Inter-state · IGST' }).click()
  await expect(results.locator('dl > div').filter({ hasText: 'IGST' })).toContainText('₹180.00')

  await page.getByRole('button', { name: 'Remove GST' }).click()
  await page.getByRole('textbox', { name: 'GST-inclusive amount' }).fill('1180')
  await expect(results.locator('dl > div').filter({ hasText: 'Taxable value' })).toContainText(
    '₹1,000.00',
  )
})

test('accepts a validated HSN rate handoff', async ({ page }) => {
  await page.goto('/toolbox/gst-calculator?rate=7.5')

  await expect(page.getByRole('textbox', { name: 'Custom rate' })).toHaveValue('7.5')
  await expect(page.getByText('Rate supplied by HSN lookup.')).toBeVisible()
})
