import { FrappeUI, frappeRequest } from 'frappe-ui'
import { createApp } from 'vue'

import App from './App.vue'
import { initializeToolboxPreferences } from './composables/toolboxPreferenceSync'
import './index.css'
import router from './router'
import { createAuthGuard } from './utils/authGuard'

const app = createApp(App)

router.beforeEach(createAuthGuard())
app.use(router)
app.use(FrappeUI, {
  call: false,
  config: {
    resourceFetcher: frappeRequest,
  },
})

const preferenceInitialization = initializeToolboxPreferences()
app.mount('#app')
void preferenceInitialization
