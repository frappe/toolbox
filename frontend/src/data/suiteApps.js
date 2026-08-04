// The Frappe Suite app-switcher tray shown in the Toolbox brand menu.
// Toolbox is not part of Suite yet, so this is a scaffolded tray: each entry links to the
// app's conventional route and opens as a full-page navigation (a separate Suite app), not
// an in-app Vue route. Update the routes when the Suite deployment finalizes them.
export const suiteApps = Object.freeze([
  { id: 'writer', name: 'Writer', icon: 'lucide-pen-line', href: '/writer' },
  { id: 'slides', name: 'Slides', icon: 'lucide-presentation', href: '/slides' },
  { id: 'meet', name: 'Meet', icon: 'lucide-video', href: '/meet' },
  { id: 'calendar', name: 'Calendar', icon: 'lucide-calendar', href: '/calendar' },
  { id: 'mail', name: 'Mail', icon: 'lucide-mail', href: '/mail' },
  { id: 'sheets', name: 'Sheets', icon: 'lucide-sheet', href: '/sheets' },
])
