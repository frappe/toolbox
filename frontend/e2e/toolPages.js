import { toolsById } from '../src/data/toolRegistry'

// Four specs walk a list of tool pages and assert the `<h1>`. That heading is the tool's name in
// the registry, so it is read from there rather than written out again: renaming a tool used to
// mean four specs asserting a heading the application no longer renders, and the split renames
// several.
//
// The lists themselves stay in each spec, because which pages are worth an axe scan, a mobile
// check or an offline reload is a judgement per spec, not the whole registry.
export function headingFor(path) {
  if (path === '/') return 'All tools'

  const tool = toolsById.get(path.slice(1))
  if (!tool) throw new Error(`${path} is not a registered tool route`)
  return tool.name
}
