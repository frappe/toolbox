import { describe, expect, it } from 'vitest'

import { parseToolContent } from './parse.js'

const MINIMAL = `## How it works

It works.

## Frequently asked questions

### Does it?

It does.
`

function parse(markdown, options) {
  return parseToolContent(markdown, { source: 'test.md', ...options })
}

describe('parsing a content file', () => {
  it('joins the lines of a wrapped paragraph', () => {
    // Prose wraps at the line length the repository uses. Two lines in a row are one paragraph.
    const { sections } = parse(`## How it works

The rate for one month
is the annual rate
divided by twelve.

## Frequently asked questions

### Does it?

It does.
`)

    expect(sections[0].blocks).toEqual([
      { type: 'paragraph', text: 'The rate for one month is the annual rate divided by twelve.' },
    ])
  })

  it('starts a new paragraph after a blank line', () => {
    const { sections } = parse(`## How it works

First.

Second.

## Frequently asked questions

### Does it?

It does.
`)

    expect(sections[0].blocks).toHaveLength(2)
  })

  it('collects the items of one list into one block', () => {
    const { sections, steps } = parse(`## How it works

1. Enter the amount.
2. Enter the rate.

- One note.
- Another note.

## Frequently asked questions

### Does it?

It does.
`)

    expect(sections[0].blocks).toEqual([
      { type: 'steps', items: ['Enter the amount.', 'Enter the rate.'] },
      { type: 'bullets', items: ['One note.', 'Another note.'] },
    ])
    expect(steps).toEqual(['Enter the amount.', 'Enter the rate.'])
  })

  it('reads a question and the paragraphs under it as one answer', () => {
    const { faqs } = parse(`## How it works

It works.

## Frequently asked questions

### Is it stored?

No.

Nothing is sent to a server.

### Does it work offline?

Yes.
`)

    expect(faqs).toEqual([
      { question: 'Is it stored?', answer: 'No. Nothing is sent to a server.' },
      { question: 'Does it work offline?', answer: 'Yes.' },
    ])
  })

  it('leaves no Markdown markers in the structured copy', () => {
    // These strings go into JSON-LD, where a search engine reads them as prose. A reader of a
    // search result would otherwise see the asterisks.
    const { faqs, steps } = parse(`## How it works

1. Read the **rate** in \`percent\`.

## Frequently asked questions

### What is an **EMI**?

An [instalment](/emi-calculator) with a fixed \`amount\`.
`)

    expect(steps).toEqual(['Read the rate in percent.'])
    expect(faqs).toEqual([{ question: 'What is an EMI?', answer: 'An instalment with a fixed amount.' }])
  })

  it('has no steps when the page explains itself in prose', () => {
    expect(parse(MINIMAL).steps).toEqual([])
  })
})

describe('refusing a content file it cannot carry', () => {
  it('names the line of a section it does not know', () => {
    expect(() => parse('## How it worked\n\nText.\n')).toThrow(/line 1: "How it worked" is not a section/)
  })

  it('rejects a section that appears twice', () => {
    expect(() => parse(`${MINIMAL}\n## How it works\n\nAgain.\n`)).toThrow(/appears twice/)
  })

  it('rejects sections written out of order', () => {
    expect(() =>
      parse(`## Frequently asked questions

### Does it?

It does.

## How it works

It works.
`),
    ).toThrow(/"How it works" comes before "Frequently asked questions"/)
  })

  it('rejects a page with no explanation or no questions', () => {
    expect(() => parse('## How it works\n\nIt works.\n')).toThrow(
      /no "Frequently asked questions" section/,
    )
    expect(() => parse('## Frequently asked questions\n\n### Does it?\n\nIt does.\n')).toThrow(
      /no "How it works" section/,
    )
  })

  it('rejects a first-level heading, because the page already has one', () => {
    expect(() => parse(`## How it works\n\n# Calculator\n`)).toThrow(/already has one/)
  })

  it('rejects a subheading in a section that has no groups', () => {
    expect(() => parse('## How it works\n\n### A step\n\nText.\n')).toThrow(
      /"How it works" holds no "### " subheadings/,
    )
  })

  it('rejects an answer with no question, and a question with no answer', () => {
    expect(() => parse('## How it works\n\nIt works.\n\n## Frequently asked questions\n\nText.\n')).toThrow(
      /before the first "### " question/,
    )
    expect(() =>
      parse('## How it works\n\nIt works.\n\n## Frequently asked questions\n\n### Does it?\n'),
    ).toThrow(/no answer under "Does it\?"/)
  })

  it('rejects text before the first section', () => {
    expect(() => parse('Loose text.\n\n## How it works\n')).toThrow(/text before the first "## "/)
  })
})

describe('checking the links a page makes', () => {
  const withLink = (target) => `## How it works

See the [other tool](${target}).

## Frequently asked questions

### Does it?

It does.
`

  it('accepts a link to a route the application serves', () => {
    expect(() => parse(withLink('/calculator'), { knownRoutes: ['/calculator'] })).not.toThrow()
  })

  it('rejects a link to a route that does not exist', () => {
    // A broken link on a page whose whole purpose is to be found is worth stopping the build for.
    expect(() => parse(withLink('/calculater'), { knownRoutes: ['/calculator'] })).toThrow(
      /not a route this application serves/,
    )
  })

  it('accepts a link out of the site over https', () => {
    // The About page exists to make some. It says who built this and what else they make.
    expect(() => parse(withLink('https://frappe.io'), { knownRoutes: ['/calculator'] })).not.toThrow()
  })

  it('rejects a link out of the site over anything else', () => {
    for (const target of ['http://frappe.io', 'ftp://frappe.io', 'mailto:hello@frappe.io']) {
      expect(() => parse(withLink(target), { knownRoutes: ['/calculator'] }), target).toThrow(
        /neither a route nor an https address/,
      )
    }
  })
})
