import { reactive } from 'vue'

const layout = reactive({
  density: 'comfortable',
  surface: 'soft',
})

export function useLayoutPreferences() {
  return layout
}
