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
  'text-to-speech': () => import('@/views/tools/TextToSpeechView.vue'),
}
const queuedToolView = () => import('@/views/ToolView.vue')

const routes = [
  {
    path: '/',
    redirect: '/all-tools',
  },
  {
    path: '/all-tools',
    name: 'AllTools',
    component: () => import('@/views/AllToolsView.vue'),
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
    redirect: '/all-tools',
  },
]

export default createRouter({
  history: createWebHistory(`${__FRONTEND_ROUTE__}/`),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
