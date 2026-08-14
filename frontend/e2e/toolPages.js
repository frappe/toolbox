import { tools, toolsById } from '../src/data/toolRegistry'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'

// Several specs walk a list of pages and assert the `<h1>`. That heading is the tool's name in the
// registry, so it is read from there rather than written out again: renaming a tool used to mean
// four specs asserting a heading the application no longer renders.
//
// The list itself is derived too, and that is the point. It used to be typed out in each spec, and
// the two lists fell six tools behind the registry — BMR, Time Zone Converter, Dictionary, Script
// Conversion, Audio Recorder and Audio Editor went unscanned and unmeasured because nobody
// remembered to add them twice. A tool now enters every sweep the moment it is registered.

// `/settings` is not here. It renders as a dialog over All Tools, so it has no heading of its own
// and no layout of its own to measure. The accessibility sweep adds it separately.
export const APP_PAGES = ['/about', '/data-sources']

export const TOOL_ROUTES = tools.map((tool) => tool.route)

export const ALL_ROUTES = ['/', ...TOOL_ROUTES, ...APP_PAGES]

// A tool that says it works offline has to work offline. The claim is the registry's own
// `offlineCapability`, so the promise the All Tools page makes to a visitor is the thing under
// test, and a new tool that claims `full` is checked from the day it is added.
export const OFFLINE_ROUTES = tools
  .filter((tool) => tool.offlineCapability === 'full')
  .map((tool) => tool.route)

// The heading a visitor reads. For a tool it is the registry name, and the server renders the same
// word into the body, so the two agree by construction.
//
// `/data-sources` is the one page where they do not. `seo.py` names it "Data Sources" and the view
// heads it "Where the data comes from", so a crawler and a visitor are told two different things.
// That is recorded in `navigation.spec.js` rather than hidden here.
const PAGE_HEADINGS = {
  '/': 'All tools',
  '/about': 'About Toolbox',
  '/data-sources': 'Where the data comes from',
}

export function headingFor(path) {
  if (PAGE_HEADINGS[path]) return PAGE_HEADINGS[path]

  const tool = toolsById.get(path.slice(1))
  if (!tool) throw new Error(`${path} is not a registered route`)
  return tool.name
}

// The two routes that need a server answer before they render anything worth looking at. Keeping
// this beside the route list means a sweep cannot forget one: adding the fixture in four specs is
// how the currency page came to be scanned in its error state.
export async function prepare(page, path) {
  if (path === '/currency-converter') await mockCurrencyRates(page)
  if (path === '/hsn-sac-lookup') await mockHsnAvailable(page)
}
