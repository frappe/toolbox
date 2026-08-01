import path from 'path'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import { defineConfig } from 'vite'

import { toolboxPwaBuild } from './build/pwaBuildPlugin.js'

export default defineConfig({
  plugins: [
    frappeui({
      frontendRoute: '/toolbox',
    }),
    vue(),
    toolboxPwaBuild(),
  ],
  server: {
    host: '127.0.0.1',
    allowedHosts: ['localhost', 'toolbox.localhost'],
  },
  build: {
    manifest: 'manifest.json',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
})
