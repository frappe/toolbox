import { describe, expect, it } from 'vitest'

import { parseToolContent } from './parse.js'
import { renderContent } from './render.js'

function render(markdown) {
  return renderContent(parseToolContent(markdown, { source: 'test.md' }).sections)
}

const MINIMAL = `## How it works

It works.

## Frequently asked questions

### Does it?

It does.
`

describe('the content block', () => {
  it('renders nothing for a page that has no content', () => {
    expect(renderContent([])).toBe('')
  })

  it('opens each section with a second-level heading', () => {
    // The page already has one h1, so the content continues the hierarchy rather than restarting it.
    const html = render(MINIMAL)

    expect(html).toContain('>How it works</h2>')
    expect(html).toContain('>Frequently asked questions</h2>')
    expect(html).not.toContain('<h1')
  })

  it('closes each section, with its heading still readable as the summary', () => {
    const html = render(MINIMAL)

    // `<details>` and no JavaScript: the server writes this block before the application boots,
    // and a disclosure that needs a script would not open there.
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html).not.toContain('<details open')
    expect(html).toContain('<summary')
    // The heading stays in the summary, so a closed page reads as a list of what it covers.
    expect(html).toMatch(/<summary[^>]*><h2[^>]*>How it works<\/h2>/)
  })

  it('keeps the whole text in the document while a section is closed', () => {
    // This is what makes a collapsed section safe. A crawler runs no JavaScript and reads the
    // markup, so text hidden by `<details>` is still text it can read. Text that only arrived on
    // a click would not be, and neither would it reach a visitor without a script.
    const html = render(MINIMAL)

    expect(html).toContain('It works.')
    expect(html).toContain('It does.')
  })

  it('renders a question and its answer as a heading and a paragraph', () => {
    const html = render(MINIMAL)

    expect(html).toContain('>Does it?</h3>')
    expect(html).toContain('>It does.</p>')
  })

  it('gives each worked example its own surface', () => {
    const html = render(`## How it works

It works.

## Worked examples

### A bill split four ways

The result is 365.8.

## Frequently asked questions

### Does it?

It does.
`)

    expect(html).toContain('rounded-xl bg-surface-gray-1')
    expect(html).toContain('>A bill split four ways</h3>')
  })

  it('keeps the run of blocks that opens a section before its first subheading', () => {
    // The questions section stays strict: a paragraph there belongs to a question. An example
    // section may open with a sentence that introduces the examples under it.
    const html = render(`## How it works

It works.

## Worked examples

Each example uses the tool's own numbers.

### A bill split four ways

The result is 365.8.

## Frequently asked questions

### Does it?

It does.
`)

    expect(html).toContain(">Each example uses the tool's own numbers.</p>")
    expect(html).toContain('>A bill split four ways</h3>')
  })

  it('leaves a list its markers', () => {
    // A flex container would drop the marker of every item inside it, so a list uses margins.
    const html = render(`## How it works

1. First.
2. Second.

- A note.

## Frequently asked questions

### Does it?

It does.
`)

    expect(html).toContain('<ol class="list-decimal space-y-2 pl-5')
    expect(html).toContain('<ul class="list-disc space-y-2 pl-5')
    expect(html).toContain('<li>First.</li>')
  })

  it('renders the three inline constructs it allows', () => {
    const html = render(`## How it works

Read the **rate** as \`percent\`, then open the [Calculator](/calculator).

## Frequently asked questions

### Does it?

It does.
`)

    expect(html).toContain('<strong class="font-medium text-ink-gray-9">rate</strong>')
    expect(html).toContain('font-mono text-sm text-ink-gray-8">percent</code>')
    expect(html).toContain('href="/calculator">Calculator</a>')
  })

  it('escapes the text of the page', () => {
    const html = render(`## How it works

A rate of 5 < 6 & rising.

## Frequently asked questions

### Does it?

It does.
`)

    expect(html).toContain('5 &lt; 6 &amp; rising')
    expect(html).not.toMatch(/5 < 6/)
  })
})
