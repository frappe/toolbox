import frappeUIPreset from 'frappe-ui/tailwind'

export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    // The tool-content renderer writes its own markup at build time, and its classes reach the
    // page through a generated JSON file that nothing else scans. Without this, a class used only
    // there is never generated, and the only symptom is content that quietly loses its styling.
    './build/toolContent/*.js',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
}
