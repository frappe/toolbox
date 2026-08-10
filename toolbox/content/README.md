# Tool content

One Markdown file holds the text of one tool page. The file is named after the route, so
`/emi-calculator` is written in `emi-calculator.md`.

The Vite build reads these files and writes one JSON file for each route into `pages/`. The server
renders that JSON into the page it sends, and the client shows the same HTML after an in-app
navigation. `toolbox/seo.py` builds `FAQPage` and `HowTo` JSON-LD from the same file.

Run `yarn build` after you change a file here. The generated files under `pages/` are committed,
and `frontend/build/toolContent/build.test.js` fails when they no longer match the Markdown.

## Why the page needs this

A visitor arrives from a search engine with a question. The tool answers one form of it. The text
answers the rest, and it is the only part of the page a crawler can read without running
JavaScript.

Write 500 to 700 words. A shorter page competes badly against the sites already ranking for these
terms.

## The format

Four sections, in this order. "How it works" and "Frequently asked questions" are required.

```markdown
## How it works

What the tool does, and how the result is reached. State the formula, or name the dataset.

1. A numbered list becomes the steps of the HowTo structured data.
2. Leave it out when the page explains itself in prose.

## Worked examples

### A name that reads like the search it answers

Real numbers, checked against the tool itself.

## Frequently asked questions

### The question in the words a person types

The answer. Every paragraph under a question belongs to that question.

## Good to know

Background, and one or two facts worth reading.
```

The build refuses a file it cannot carry, and names the line: an unknown section, a section written
twice or out of order, a `# ` heading, an answer with no question, a question with no answer.

Three inline constructs are allowed, and no more. `**bold**` for a term, `` `code` `` for a formula
or an expression, and `[a link](/another-tool)` to another tool. A link must point at a route this
application serves, and the build checks that it does.

Prose wraps. Two lines in a row are one paragraph, and a blank line starts the next.

## Rules for the text

1. Check every number in a worked example against the tool itself.
2. Name the source of a fact. Weather reads MET Norway. Dictionary reads WordNet 3.1.
3. State no rate, rule or law the tool does not itself compute. Tax rates change.
4. Write in Simplified Technical English, the same as the rest of the repository.
5. Answer the question a visitor arrived with. Do not sell the tool to them.
