// The one renderer of tool content.
//
// The server sends this HTML inside `<div id="app">`, and the client shows the same string again
// after an in-app navigation. Both read the output of this module, so the words a crawler reads and
// the words a visitor reads cannot drift apart.
//
// The markup carries the application's own tokens, because the built stylesheet is already in the
// head when the server block paints, before any JavaScript runs.

const PROSE = 'text-base leading-7 text-ink-gray-7'
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col'
const EXAMPLE_SURFACE = 'flex flex-col gap-3 rounded-xl bg-surface-gray-1 p-4 sm:p-5'

// A tool page sets its own width, from three to six columns wide, so the content cannot share a
// lane with every one of them. It reads as its own band instead: a rule across the page, and a
// measure narrow enough to read comfortably under it.
export function renderContent(sections) {
  if (!sections.length) return ''

  const body = sections.map(renderSection).join('')
  return `<div class="w-full border-t border-outline-gray-2"><div class="${COLUMN} gap-2 px-4 pt-10 pb-16 sm:px-8">${body}</div></div>`
}

// A section is closed until somebody opens it. The tool is what a visitor came for, and the words
// under it used to push it up a wall of prose.
//
// `<details>` and nothing else. The text stays in the document either way, which is what keeps it
// readable to a crawler, and it opens with no JavaScript, which matters because the server writes
// this block before the application has booted. Text that only arrives on a click would be neither.
//
// The heading stays visible as the summary, so the closed page reads as a list of what it covers.
function renderSection(section) {
  const heading = `<h2 class="text-xl font-semibold tracking-tight text-ink-gray-9">${escape(section.title)}</h2>`
  // Two icons, and `display` decides which one shows. Rotating one was tried twice and lost the
  // cascade both times: `group-open:rotate-180` resolves through Tailwind's `--tw-rotate` chain,
  // which never reached this span, and a plain `transform` rule matched the element and still
  // computed to an identity matrix. `display` is not fought over.
  const marker =
    `<span class="lucide-chevron-down size-5 shrink-0 text-ink-gray-5" data-disclosure-closed aria-hidden="true"></span>` +
    `<span class="lucide-chevron-up size-5 shrink-0 text-ink-gray-5" data-disclosure-open aria-hidden="true"></span>`
  const summary = `<summary class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-1 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3">${heading}${marker}</summary>`
  return `<details class="flex flex-col border-b border-outline-gray-2 pb-4">${summary}<div class="flex flex-col gap-4 pt-4">${renderBlocks(section)}</div></details>`
}

// A subheading opens a group that runs until the next one: a question and its answer, or an example
// and its working. A section without subheadings is a flat run of blocks.
function renderBlocks(section) {
  const groups = groupBySubheading(section.blocks)
  if (groups.length === 1 && !groups[0].heading) return renderBlockRun(groups[0].blocks)

  // An example sits on its own surface, because it is a worked calculation rather than prose.
  const wrapper =
    section.title === 'Worked examples' ? EXAMPLE_SURFACE : 'flex flex-col gap-2'
  // A section may open with a sentence before its first subheading. That run belongs to the
  // section rather than to a group, so it keeps the plain treatment.
  const rendered = groups.map((group) =>
    group.heading ? renderGroup(group, wrapper) : renderBlockRun(group.blocks),
  )
  return `<div class="flex flex-col gap-6">${rendered.join('')}</div>`
}

function renderGroup(group, wrapper) {
  const heading = `<h3 class="text-base font-medium text-ink-gray-9">${inline(group.heading)}</h3>`
  return `<div class="${wrapper}">${heading}${renderBlockRun(group.blocks)}</div>`
}

function groupBySubheading(blocks) {
  const groups = [{ heading: '', blocks: [] }]
  for (const block of blocks) {
    if (block.type === 'subheading') groups.push({ heading: block.text, blocks: [] })
    else groups.at(-1).blocks.push(block)
  }
  return groups[0].blocks.length ? groups : groups.slice(1)
}

function renderBlockRun(blocks) {
  return blocks.map(renderBlock).join('')
}

function renderBlock(block) {
  if (block.type === 'paragraph') return `<p class="${PROSE}">${inline(block.text)}</p>`

  // A list keeps its markers, so it uses vertical margins rather than a flex column. A flex
  // container drops the marker of every item inside it.
  const tag = block.type === 'steps' ? 'ol' : 'ul'
  const style = block.type === 'steps' ? 'list-decimal' : 'list-disc'
  const items = block.items.map((item) => `<li>${inline(item)}</li>`).join('')
  return `<${tag} class="${style} space-y-2 pl-5 ${PROSE}">${items}</${tag}>`
}

// Three inline constructs, and no more. Bold for a term, code for a formula, and a link, either to
// another tool or out of the site.
function inline(text) {
  return escape(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => link(label, target))
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-medium text-ink-gray-9">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-surface-gray-2 px-1.5 py-0.5 font-mono text-sm text-ink-gray-8">$1</code>',
    )
}

function link(label, target) {
  // A link out of the site opens in its own tab, and carries no referrer. It carries no `nofollow`
  // either: the pages this recommends are ones the site means to recommend.
  const outbound = target.startsWith('https://') ? ' target="_blank" rel="noreferrer"' : ''
  return `<a class="text-ink-gray-9 underline underline-offset-2 hover:text-ink-gray-7" href="${target}"${outbound}>${label}</a>`
}

function escape(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
