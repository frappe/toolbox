import { expect, test } from './fixtures'
import { resetToolboxPreferences, seedToolboxPreferences } from './support/preferences'
import { toolCases } from '../src/test/toolCases'

// One test for each case in `src/test/toolCases`. The cases say what a tool should answer; this
// file is only the hand that types it in and reads the screen.
//
// Every locator is scoped to `#main-content`. The sidebar carries an `aria-label` on every row, so
// an unscoped `getByLabel('Weight')` matches the link to the Weight Converter as well as the input
// on the page.
for (const tool of toolCases) {
  test.describe(tool.toolId, () => {
    for (const scenario of tool.cases) {
      test(
        `${tool.toolId}: ${scenario.name}`,
        {
          annotation: [
            { type: 'tool', description: tool.toolId },
            { type: 'check', description: 'correctness' },
          ],
        },
        async ({ page }) => {
          await open(page, tool)
          const main = page.locator('#main-content')

          for (const step of scenario.fill) await apply(page, main, step)
          await assert(page, main, tool, scenario.expect)
        },
      )
    }
  })
}

async function open(page, tool) {
  if (tool.fixture) await tool.fixture(page)
  if (tool.seed) {
    // The store reads storage once, at module load, so the write has to happen on the origin and
    // before the navigation under test.
    await page.goto('/')
    await resetToolboxPreferences(page)
    await seedToolboxPreferences(page, tool.seed)
  }
  await page.goto(tool.route)
}

async function apply(page, main, step) {
  if (step.id !== undefined || step.label !== undefined) {
    const field = fieldFor(main, step)
    await field.fill(step.value)
    if (step.submit) await field.press('Enter')
    return
  }

  if (step.select !== undefined) {
    // frappe-ui's Select is a reka listbox, not a native <select>, so it opens and is chosen from
    // rather than selected into.
    await main.getByLabel(step.select).click()
    await page.getByRole('option', { name: step.option, exact: false }).first().click()
    return
  }

  if (step.unit !== undefined) {
    await main.getByRole('button', { name: new RegExp(`^${step.unit}`) }).click()
    const search = page.getByRole('combobox', { name: `Search ${step.unit.toLowerCase()}` })
    await search.fill(step.pick)
    await page.getByRole('option', { name: step.pick, exact: false }).first().click()
    return
  }

  if (step.combobox !== undefined) {
    const field = main.getByRole('combobox', { name: step.combobox })
    await field.fill(step.value)
    await page.getByRole('option', { name: step.option }).first().click()
    return
  }

  if (step.search !== undefined) {
    const field = main.getByRole('searchbox').first()
    await field.fill(step.search)
    if (step.submit) await field.press('Enter')
    return
  }

  if (step.radio !== undefined) {
    await main.getByRole('radio', { name: step.radio }).click()
    return
  }

  if (step.click !== undefined) {
    await main.getByRole('button', { name: step.click, exact: true }).click()
    return
  }

  throw new Error(`Unknown step: ${JSON.stringify(step)}`)
}

// A label alone is not always unique inside the page. The calculator writes "Expression" on its
// input and on two keypad buttons, and the health calculators repeat "Distance" and "Duration" on
// the result rows beside the inputs. So a case may name the element by its id, or narrow the label
// by role, and a plain label is used only where it already resolves to one element.
function fieldFor(main, step) {
  if (step.id !== undefined) return main.locator(`#${step.id}`)
  if (step.role !== undefined) return main.getByRole(step.role, { name: step.label, exact: true })
  return main.getByLabel(step.label)
}

async function assert(page, main, tool, expected) {
  // The content below every tool repeats the words the interface uses, because it describes the
  // interface. So a result lookup is scoped to the result, never to the page.
  const region = main.getByRole('region', { name: 'Result' })
  const result = (await region.count()) ? region.first() : main

  if (expected.alert !== undefined) {
    await expect(main.getByRole('alert').first()).toContainText(expected.alert)
    return
  }

  if (expected.primary !== undefined) {
    // `toHaveText` takes a string or a pattern, so a case may give either.
    await expect(main.getByRole(tool.primary.role, { name: tool.primary.name })).toHaveText(
      expected.primary,
    )
  }

  if (expected.primaryAbove !== undefined) {
    const output = main.getByRole(tool.primary.role, { name: tool.primary.name })
    const shown = Number((await output.textContent()).replace(/[^\d.-]/g, ''))
    expect(shown).toBeGreaterThan(expected.primaryAbove)
  }

  if (expected.value !== undefined) {
    await expect(main.getByLabel(expected.value.label)).toHaveValue(expected.value.is)
  }

  for (const fragment of expected.contains || []) {
    await expect(result).toContainText(fragment)
  }

  if (expected.control !== undefined) {
    await expect(main.getByRole('button', { name: expected.control }).first()).toBeVisible()
  }

  if (expected.absent !== undefined) {
    await expect(main.getByText(expected.absent, { exact: true })).toHaveCount(0)
  }
}
