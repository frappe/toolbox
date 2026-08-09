export const toolCategories = [
  { id: 'calculate', name: 'Calculate', icon: 'lucide-calculator' },
  { id: 'convert', name: 'Convert', icon: 'lucide-arrow-right-left' },
  { id: 'india', name: 'India', icon: 'lucide-map-pinned' },
  { id: 'time', name: 'Time', icon: 'lucide-clock-3' },
  { id: 'media', name: 'Media', icon: 'lucide-mic' },
  { id: 'information', name: 'Information', icon: 'lucide-library' },
]

export const tools = [
  defineTool({
    id: 'calculator',
    name: 'Calculator',
    description: 'Everyday arithmetic and scientific expressions with history.',
    icon: 'lucide-calculator',
    category: 'calculate',
    route: '/calculator',
    offlineCapability: 'full',
    searchKeywords: ['math', 'scientific', 'percentage', 'expression'],
  }),
  defineTool({
    id: 'gst-calculator',
    name: 'GST Calculator',
    description: 'Add or remove GST and split CGST, SGST, or IGST.',
    icon: 'lucide-percent',
    category: 'india',
    route: '/gst-calculator',
    offlineCapability: 'full',
    searchKeywords: ['tax', 'cgst', 'sgst', 'igst', 'india'],
  }),
  defineTool({
    id: 'financial-calculators',
    name: 'Financial Calculators',
    description: 'Estimate EMI, compound interest, SIP, CAGR, and break-even.',
    icon: 'lucide-landmark',
    category: 'calculate',
    route: '/financial-calculators',
    offlineCapability: 'full',
    searchKeywords: ['loan', 'emi', 'sip', 'cagr', 'interest', 'break-even'],
  }),
  defineTool({
    id: 'health-calculators',
    name: 'Health & Fitness Calculators',
    description: 'Calculate BMI, BMR, maintenance calories, and pace.',
    icon: 'lucide-activity',
    category: 'calculate',
    route: '/health-calculators',
    offlineCapability: 'full',
    searchKeywords: ['bmi', 'bmr', 'calories', 'pace', 'fitness'],
  }),
  defineTool({
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert common measurements accurately without an external API.',
    icon: 'lucide-ruler',
    category: 'convert',
    route: '/unit-converter',
    offlineCapability: 'full',
    searchKeywords: ['length', 'weight', 'temperature', 'speed', 'storage'],
  }),
  defineTool({
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert currencies using dated institutional reference rates.',
    icon: 'lucide-badge-dollar-sign',
    category: 'convert',
    route: '/currency-converter',
    offlineCapability: 'cached',
    searchKeywords: ['exchange', 'forex', 'reference rate', 'money'],
  }),
  defineTool({
    id: 'hsn-sac-lookup',
    name: 'HSN & SAC Lookup',
    description: 'Search Indian HSN and SAC codes and descriptions.',
    icon: 'lucide-search',
    category: 'india',
    route: '/hsn-sac-lookup',
    offlineCapability: 'partial',
    searchKeywords: ['hsn', 'sac', 'code', 'classification', 'gst'],
  }),
  defineTool({
    id: 'india-business-lookup',
    name: 'India Business Lookup',
    description: 'Search Indian PIN codes and bank IFSC codes.',
    icon: 'lucide-building-2',
    category: 'india',
    route: '/india-business-lookup',
    offlineCapability: 'partial',
    featureFlag: 'india_business_lookup',
    releaseStatus: 'available',
    externalDependencyStatus: 'datasets-required',
    searchKeywords: ['pin code', 'ifsc', 'bank', 'post office'],
  }),
  defineTool({
    id: 'world-clock',
    name: 'World Clock',
    description: 'Compare time zones and find shared working-hour overlaps.',
    icon: 'lucide-globe-2',
    category: 'time',
    route: '/world-clock',
    offlineCapability: 'full',
    searchKeywords: ['timezone', 'meeting', 'city', 'iana', 'planner'],
  }),
  defineTool({
    id: 'timer',
    name: 'Timer, Stopwatch & Countdown',
    description: 'Keep time accurately across pauses, refreshes, and date changes.',
    icon: 'lucide-timer',
    category: 'time',
    route: '/timer',
    offlineCapability: 'full',
    searchKeywords: ['alarm', 'lap', 'duration', 'date countdown'],
  }),
  defineTool({
    id: 'weather',
    name: 'Weather',
    description: 'View current conditions and forecasts with honest attribution.',
    icon: 'lucide-cloud-sun',
    category: 'information',
    route: '/weather',
    offlineCapability: 'cached',
    releaseStatus: 'available',
    externalDependencyStatus: 'none',
    searchKeywords: ['forecast', 'temperature', 'rain', 'wind', 'humidity'],
  }),
  defineTool({
    id: 'dictionary',
    name: 'Dictionary',
    description: 'Look up English definitions from an openly licensed dataset.',
    icon: 'lucide-book-open',
    category: 'information',
    route: '/dictionary',
    offlineCapability: 'server-dataset',
    releaseStatus: 'available',
    externalDependencyStatus: 'none',
    searchKeywords: ['word', 'definition', 'meaning', 'spelling', 'pronunciation'],
  }),
  defineTool({
    id: 'script-conversion',
    name: 'Script Conversion',
    description: 'Transliterate text between Indic scripts and Roman schemes, on your device.',
    icon: 'lucide-languages',
    category: 'information',
    route: '/script-conversion',
    offlineCapability: 'full',
    searchKeywords: ['transliterate', 'script', 'devanagari', 'tamil', 'iast', 'itrans', 'language', 'romanise'],
  }),
  defineTool({
    id: 'audio-recorder',
    name: 'Audio Recorder',
    description: 'Record voice notes in your browser and keep them in a private library.',
    icon: 'lucide-mic',
    category: 'media',
    route: '/audio-recorder',
    offlineCapability: 'none',
    searchKeywords: ['audio', 'record', 'voice', 'microphone', 'memo', 'sound'],
  }),
  defineTool({
    id: 'audio-editor',
    name: 'Audio Editor',
    description: 'Trim, fade and adjust an audio clip in your browser and export a WAV.',
    icon: 'lucide-audio-lines',
    category: 'media',
    route: '/audio-editor',
    offlineCapability: 'none',
    searchKeywords: ['audio', 'editor', 'trim', 'cut', 'fade', 'wav', 'convert', 'sound'],
  }),
]

export const toolsById = new Map(tools.map((tool) => [tool.id, tool]))

export function getCategory(categoryId) {
  return toolCategories.find((category) => category.id === categoryId)
}

export function getToolsByCategory(categoryId) {
  return tools.filter((tool) => tool.category === categoryId)
}

export function isToolAvailable(tool) {
  return tool.releaseStatus === 'available'
}

function defineTool(tool) {
  return Object.freeze({
    featureFlag: null,
    releaseStatus: 'available',
    externalDependencyStatus: 'none',
    ...tool,
  })
}
