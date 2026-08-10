import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { getFamily, toolsById } from '@/data/toolRegistry'

// Some tools share a view because they share the state behind it: a running timer has to survive
// a move to the stopwatch. Each still has its own route, its own heading and its own entry in
// `toolbox/seo.py`, so a visitor arriving from a search engine lands on one tool, not on a tab
// strip they have to read before they can start.
//
// The view asks this which of its tools it is rendering, and gets the registry entry back. The
// heading and the description come from the registry rather than from a second list in the
// template, so a tool's name is written once.
export function useToolFamily() {
  const route = useRoute()
  const tool = computed(() => toolsById.get(route.meta.toolId))
  const variant = computed(() => tool.value?.variant ?? null)

  // The strip that used to switch tabs now navigates. `TabButtons` renders an option carrying a
  // `route` as a RouterLink, so these are real links: a crawler can follow them, and a visitor
  // can open one in a new tab.
  const siblingLinks = computed(() => {
    const family = tool.value?.family
    if (!family) return []

    return getFamily(family).map((sibling) => ({
      label: sibling.name,
      value: sibling.variant,
      route: sibling.route,
    }))
  })

  return { tool, variant, siblingLinks }
}
