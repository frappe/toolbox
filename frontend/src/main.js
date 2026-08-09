import { FrappeUI, frappeRequest } from 'frappe-ui'
import { createApp } from 'vue'

import App from './App.vue'
import './index.css'
import router from './router'
import { syncPageMetadata } from './utils/pageMetadata'

const app = createApp(App)

app.use(router)
syncPageMetadata(router)
app.use(FrappeUI, {
  call: false,
  config: {
    resourceFetcher: frappeRequest,
  },
})

// Preferences load from the browser in the store's constructor, so there is nothing to await.
app.mount('#app')
