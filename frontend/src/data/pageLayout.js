// One width for every tool page, and the same width for the content rendered under it.
//
// The two used to disagree. A tool ran to 1152px and its explanation sat in a 768px band down the
// middle, so the right half of the page below the rule was empty (#274). The views disagreed with
// each other as well, from 768px to 1152px, which meant two tools next to each other in the
// sidebar started at different left edges.
//
// 1152px is the widest that was already in use, so no page got narrower. At 16px it leaves a
// paragraph around 110 characters, which is inside a comfortable measure — and the words under a
// tool are the reason this site exists, so that is not a detail.
export const TOOL_PAGE_WIDTH = 'max-w-6xl'

// A page that is prose rather than a tool keeps a reading measure instead. There is no mismatch to
// fix on these: the page and the content under it are both prose and both already narrow.
export const PROSE_PAGE_WIDTH = 'max-w-3xl'

const PROSE_ROUTES = new Set(['/about', '/data-sources'])

export function pageWidthFor(route) {
  return PROSE_ROUTES.has(route) ? PROSE_PAGE_WIDTH : TOOL_PAGE_WIDTH
}
