// The content of one tool page, read from its Markdown source.
//
// The format is deliberately small. A content file is prose, and every construct it allows has to
// survive three destinations: the HTML the server sends, the HTML the client shows after an in-app
// navigation, and the plain text that goes into FAQPage and HowTo JSON-LD. Markdown that a general
// parser accepts but those three cannot carry is rejected here, naming the line that caused it.

export const SECTION_TITLES = [
  'How it works',
  'Worked examples',
  'Frequently asked questions',
  'Good to know',
]

// A page without these two says nothing a search engine can use.
const REQUIRED_SECTIONS = ['How it works', 'Frequently asked questions']

// Only these two sections hold subheadings, and in each one a subheading means something
// structural: a question in the first, the name of an example in the second.
const SECTIONS_WITH_SUBHEADINGS = ['Frequently asked questions', 'Worked examples']

const SECTION_PATTERN = /^##\s+(.+?)\s*$/
const SUBHEADING_PATTERN = /^###\s+(.+?)\s*$/
const BULLET_PATTERN = /^-\s+(.+?)\s*$/
const STEP_PATTERN = /^\d+\.\s+(.+?)\s*$/
const LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/g

export class ContentError extends Error {}

export function parseToolContent(markdown, { source = 'a content file', knownRoutes = [] } = {}) {
  const sections = readSections(splitLines(markdown), source)

  const titles = sections.map((section) => section.title)
  const missing = REQUIRED_SECTIONS.filter((title) => !titles.includes(title))
  if (missing.length) throw new ContentError(`${source}: no ${quoteList(missing)} section`)
  checkLinkTargets(sections, source, knownRoutes)

  return { sections, faqs: readFaqs(sections, source), steps: readSteps(sections) }
}

// A section holds blocks, in the order they were written. A block is the unit both renderers work
// in: a paragraph, a list, or the subheading that opens a question or an example.
function readSections(lines, source) {
  const sections = []
  let section = null
  // The block a following line can continue. Prose wraps, so two lines in a row are one paragraph,
  // and a blank line is what ends it.
  let open = null

  for (const { text, number } of lines) {
    const at = `${source}, line ${number}`
    const title = SECTION_PATTERN.exec(text)?.[1]
    if (title) {
      section = openSection(sections, title, at)
      open = null
      continue
    }

    if (!text.trim()) {
      open = null
      continue
    }
    if (!section) throw new ContentError(`${at}: text before the first "## " section`)
    if (text.startsWith('# ')) {
      throw new ContentError(`${at}: a content file has no "# " heading. The page already has one`)
    }
    open = addLine(section, open, text, at)
  }

  return sections
}

function openSection(sections, title, at) {
  if (!SECTION_TITLES.includes(title)) {
    throw new ContentError(`${at}: "${title}" is not a section. Use ${quoteList(SECTION_TITLES)}`)
  }
  if (sections.some((section) => section.title === title)) {
    throw new ContentError(`${at}: "${title}" appears twice`)
  }

  // The order is fixed, so a reader who knows one page knows where to look on the next.
  const previous = sections.at(-1)
  if (previous && SECTION_TITLES.indexOf(previous.title) > SECTION_TITLES.indexOf(title)) {
    throw new ContentError(`${at}: "${title}" comes before "${previous.title}"`)
  }

  const section = { title, blocks: [] }
  sections.push(section)
  return section
}

function addLine(section, open, text, at) {
  const subheading = SUBHEADING_PATTERN.exec(text)?.[1]
  if (subheading) {
    if (!SECTIONS_WITH_SUBHEADINGS.includes(section.title)) {
      throw new ContentError(`${at}: "${section.title}" holds no "### " subheadings`)
    }
    section.blocks.push({ type: 'subheading', text: subheading })
    return null
  }

  const bullet = BULLET_PATTERN.exec(text)?.[1]
  if (bullet) return addItem(section, open, 'bullets', bullet)

  const step = STEP_PATTERN.exec(text)?.[1]
  if (step) return addItem(section, open, 'steps', step)

  if (open?.type === 'paragraph') {
    open.text = `${open.text} ${text.trim()}`
    return open
  }
  if (open?.items) {
    open.items[open.items.length - 1] += ` ${text.trim()}`
    return open
  }

  const paragraph = { type: 'paragraph', text: text.trim() }
  section.blocks.push(paragraph)
  return paragraph
}

function addItem(section, open, type, item) {
  if (open?.type === type) {
    open.items.push(item)
    return open
  }
  const block = { type, items: [item] }
  section.blocks.push(block)
  return block
}

function readFaqs(sections, source) {
  const faqs = []
  for (const block of blocksOf(sections, 'Frequently asked questions')) {
    if (block.type === 'subheading') {
      faqs.push({ question: block.text, answer: [] })
      continue
    }
    if (!faqs.length) throw new ContentError(`${source}: an answer before the first "### " question`)
    faqs.at(-1).answer.push(block.type === 'paragraph' ? block.text : block.items.join(' '))
  }

  const unanswered = faqs.filter((faq) => !faq.answer.length).map((faq) => faq.question)
  if (unanswered.length) throw new ContentError(`${source}: no answer under ${quoteList(unanswered)}`)

  return faqs.map((faq) => ({ question: plain(faq.question), answer: plain(faq.answer.join(' ')) }))
}

// The numbered list under "How it works", when the page has one. These become the HowTo steps.
function readSteps(sections) {
  const steps = blocksOf(sections, 'How it works').find((block) => block.type === 'steps')
  return steps ? steps.items.map(plain) : []
}

// JSON-LD carries a question, an answer and a step as plain strings. A reader of a search result
// would see the Markdown markers themselves, so they come out here rather than in the schema.
function plain(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function blocksOf(sections, title) {
  return sections.find((section) => section.title === title)?.blocks ?? []
}

// A link to a route the application does not serve is a broken link on a page whose whole purpose
// is to be found. The registry knows every route, so the build settles it.
function checkLinkTargets(sections, source, knownRoutes) {
  if (!knownRoutes.length) return

  for (const target of linkTargets(sections)) {
    if (!target.startsWith('/')) {
      throw new ContentError(`${source}: "${target}" is not an internal link. A link starts with /`)
    }
    if (!knownRoutes.includes(target)) {
      throw new ContentError(`${source}: "${target}" is not a route this application serves`)
    }
  }
}

function linkTargets(sections) {
  const targets = []
  for (const section of sections) {
    for (const block of section.blocks) {
      for (const line of block.items ?? [block.text]) {
        for (const [, target] of line.matchAll(LINK_PATTERN)) targets.push(target)
      }
    }
  }
  return targets
}

function splitLines(markdown) {
  return markdown.split('\n').map((text, index) => ({ text, number: index + 1 }))
}

function quoteList(values) {
  return values.map((value) => `"${value}"`).join(', ')
}
