import { expect, test } from './fixtures'
import { tools } from '../src/data/toolRegistry'

// The frappe-ui Checkbox root is `inline-flex`, so vertical margin between siblings does nothing
// for it. The tool list used `space-y-2` and the boxes flowed inline with no horizontal gap: each
// label ran into the next control, and the r of "Calculator" touched the EMI checkbox.
//
// jsdom has no layout, so a unit test cannot see this. The check is geometric on purpose.
// Settings is a dialog with its own sidebar. The tool list is its second panel, and reka unmounts
// an inactive panel, so every check here opens that tab first, the same as a visitor.
async function openSidebarTools(page) {
  await page.getByRole('tab', { name: 'Sidebar tools' }).click()
  await expect(page.getByRole('heading', { name: 'Sidebar tools' })).toBeVisible()
}

async function checkboxBoxes(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input[type=checkbox]')]
      .map((box) => box.parentElement.getBoundingClientRect())
      .map(({ top, right, bottom, left }) => ({ top, right, bottom, left })),
  )
}

// The broken layout did not overlap: the boxes sat flush against each other, which is why the
// label text touched the next control. So the check is the gap between neighbours, not overlap.
const MINIMUM_GAP = 8

function crowdedNeighbours(boxes) {
  const rows = new Map()
  for (const box of boxes) {
    const row = Math.round(box.top / 4)
    rows.set(row, [...(rows.get(row) ?? []), box])
  }

  const crowded = []
  for (const row of rows.values()) {
    const ordered = [...row].sort((a, b) => a.left - b.left)
    for (let i = 1; i < ordered.length; i += 1) {
      const gap = ordered[i].left - ordered[i - 1].right
      if (gap < MINIMUM_GAP) crowded.push(Math.round(gap))
    }
  }
  return crowded
}

for (const [width, height] of [
  [1280, 900],
  [375, 812],
]) {
  test(`keeps every sidebar-tool checkbox clear of the next at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/settings')
    await openSidebarTools(page)

    const boxes = await checkboxBoxes(page)

    // From the registry, so removing a tool does not turn this into a failure to maintain.
    expect(boxes.length).toBe(tools.length)
    expect(crowdedNeighbours(boxes)).toEqual([])
  })
}

test('brings the hidden tools back when the settings are reset', async ({ page }) => {
  await page.goto('/settings')
  await openSidebarTools(page)
  const calculator = page.getByRole('checkbox', { name: 'Calculator', exact: true })
  const emi = page.getByRole('checkbox', { name: 'EMI Calculator', exact: true })

  await calculator.uncheck()
  await emi.uncheck()
  await expect(page.getByRole('button', { name: 'Reset settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Reset settings' }).click()

  await expect(calculator).toBeChecked()
  await expect(emi).toBeChecked()
  // The sidebar reads the same list, and it is what a hidden tool disappears from.
  const stored = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('toolbox:preferences:v1') ?? '{}').hiddenToolIds,
  )
  expect(stored).toEqual([])
})

test('keeps the tool list inside the page on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/settings')
  await openSidebarTools(page)

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )

  expect(overflows).toBe(false)
})

test('opens settings as a dialog over the page, and leaves the route when it closes', async ({ page }) => {
  // The dialog stays behind the /settings route: the route is linked from the navigation, it is
  // published, and the server answers it with `noindex, follow`. A dialog with no URL would lose
  // the link, the bookmark and that header.
  await page.goto('/calculator')
  await page.getByRole('button', { name: 'Toolbox menu' }).click()
  // The brand menu is a Dropdown, so its entries carry `role="menuitem"` rather than `link`,
  // even though each one is an anchor.
  await page.getByRole('menuitem', { name: 'Settings' }).click()

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Preferences' })).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('Escape')

  // Back to the tool the visitor came from, rather than leaving the URL naming a closed dialog.
  await expect(page).toHaveURL(/\/calculator$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('sends a visitor who arrived at settings directly to All Tools when it closes', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'All tools' })).toBeVisible()
})
