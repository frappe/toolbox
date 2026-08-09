import path from 'path'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import { defineConfig } from 'vite'

import { toolboxPwaBuild } from './build/pwaBuildPlugin.js'

export default defineConfig({
  plugins: [
    frappeui({
      // Toolbox owns the site root, so the router base is `/`.
      frontendRoute: '/',
      // The plugin names the output HTML after frontendRoute, which at the root strips to an
      // empty name and writes `www/.html`. It only forwards nested `buildConfig` options, so the
      // path has to be set here rather than alongside frontendRoute.
      buildConfig: {
        indexHtmlPath: '../toolbox/www/toolbox.html',
      },
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
