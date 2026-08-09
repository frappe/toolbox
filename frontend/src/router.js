import { createRouter, createWebHistory } from 'vue-router'

import { tools } from '@/data/toolRegistry'

const implementedToolViews = {
  calculator: () => import('@/views/tools/CalculatorView.vue'),
  'currency-converter': () => import('@/views/tools/CurrencyConverterView.vue'),
  'financial-calculators': () => import('@/views/tools/FinancialCalculatorsView.vue'),
  'health-calculators': () => import('@/views/tools/HealthCalculatorsView.vue'),
  'hsn-sac-lookup': () => import('@/views/tools/HsnSacLookupView.vue'),
  'india-business-lookup': () => import('@/views/tools/IndiaBusinessLookupView.vue'),
  'gst-calculator': () => import('@/views/tools/GstCalculatorView.vue'),
  timer: () => import('@/views/tools/TimerView.vue'),
  'unit-converter': () => import('@/views/tools/UnitConverterView.vue'),
  'world-clock': () => import('@/views/tools/WorldClockView.vue'),
  weather: () => import('@/views/tools/WeatherView.vue'),
  dictionary: () => import('@/views/tools/DictionaryView.vue'),
  'script-conversion': () => import('@/views/tools/ScriptConversionView.vue'),
  'audio-recorder': () => import('@/views/tools/AudioRecorderView.vue'),
  'audio-editor': () => import('@/views/tools/AudioEditorView.vue'),
}
const queuedToolView = () => import('@/views/ToolView.vue')

const routes = [
  {
    // The root is All Tools. A visitor arriving at frappe.tools sees the whole set at once.
    path: '/',
    name: 'AllTools',
    component: () => import('@/views/AllToolsView.vue'),
  },
  {
    // Kept so an old in-app link still lands somewhere sensible. The server sends a 308 for
    // this path, so it is only reachable through client-side navigation.
    path: '/all-tools',
    redirect: '/',
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  ...tools.map((tool) => ({
    path: tool.route,
    name: `Tool:${tool.id}`,
    component: implementedToolViews[tool.id] ?? queuedToolView,
    meta: { toolId: tool.id },
  })),
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

// __FRONTEND_ROUTE__ is `/` at the site root and `/toolbox` under a prefix. Normalise to one
// trailing slash rather than appending unconditionally, which would give `//` at the root.
const routerBase = __FRONTEND_ROUTE__.endsWith('/') ? __FRONTEND_ROUTE__ : `${__FRONTEND_ROUTE__}/`

export default createRouter({
  history: createWebHistory(routerBase),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
