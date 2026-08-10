import { describe, expect, it } from 'vitest'

import { parseToolContent } from './parse.js'
import { renderContent, renderHeader } from './render.js'

function render(markdown) {
  return renderContent(parseToolContent(markdown, { source: 'test.md' }).sections)
}

const MINIMAL = `## How it works

It works.

## Frequently asked questions

### Does it?

It does.
`

describe('the heading block', () => {
  it('carries the name and the description of the tool', () => {
    const header = renderHeader({ name: 'EMI Calculator', description: 'Work out an instalment.' })

    expect(header).toContain('<h1 class="text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">EMI Calculator</h1>')
    expect(header).toContain('Work out an instalment.')
  })

  it('tells a visitor with no JavaScript why the tool is missing', () => {
    expect(renderHeader({ name: 'Calculator', description: 'Math.' })).toContain('<noscript>')
  })

  it('escapes the text it is given', () => {
    const header = renderHeader({ name: '<script>x</script>', description: 'A "quoted" name.' })

    expect(header).not.toContain('<script>')
    expect(header).toContain('&lt;script&gt;')
  })
})

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
