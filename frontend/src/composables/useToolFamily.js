import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { toolsById } from '@/data/toolRegistry'

// Some tools share a view because they share the state behind it: a running timer has to survive
// a move to the stopwatch. Each still has its own route, its own heading and its own entry in
// `toolbox/seo.py`, so a visitor arriving from a search engine lands on one tool.
//
// Sharing a view is all it means. The siblings are not offered on the page: one item in the
// sidebar is one page, and the sidebar is the only place a tool is listed.
//
// The view asks this which of its tools it is rendering, and gets the registry entry back. The
// heading and the description come from the registry rather than from a second list in the
// template, so a tool's name is written once.
export function useToolFamily() {
  const route = useRoute()
  const tool = computed(() => toolsById.get(route.meta.toolId))
  const variant = computed(() => tool.value?.variant ?? null)

  return { tool, variant }
}
