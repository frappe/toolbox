import { tools } from '@/data/toolRegistry'

// Frappe puts every route's title here, from toolbox/seo.py, through the boot payload. The
// client repeats the server's own text rather than composing a second version of it: a crawler
// reads the served HTML and then renders the page, so two titles for one page is a contradiction
// it can see.
//
// The offline shell is cached with no boot payload at all, so this is often absent. That is the
// case the registry fallback exists for.
const SITE_NAME = 'Toolbox'

export function resolveTitle(path, titles = globalThis.toolbox_page_titles) {
  const serverTitle = titles?.[path]
  if (serverTitle) return serverTitle

  const tool = tools.find((candidate) => candidate.route === path)
  return tool ? `${tool.name} | ${SITE_NAME}` : SITE_NAME
}

// Only the title and the canonical link move with an in-app navigation. The description and the
// robots rule stay as the server rendered them, on purpose: a crawler fetches each URL and reads
// the response for that URL, so it never sees the head that clicking through the app produces.
// The title is updated because the visitor reads it, and the canonical because it is free to
// derive and it is the one tag whose failure would fold every route into a single URL. Shipping
// a description for every route to fix a tag nobody reads in this state is not worth the bytes.
//
// The origin is passed in rather than defaulted, because a default parameter would hide the one
// case worth handling: no location at all.
export function resolveCanonical(path, origin) {
  return origin ? `${origin}${path}` : path
}

export function applyPageMetadata(path, documentRef = globalThis.document) {
  if (!documentRef) return

  documentRef.title = resolveTitle(path)

  const canonical = documentRef.querySelector('link[rel="canonical"]')
  if (canonical) canonical.setAttribute('href', resolveCanonical(path, globalThis.location?.origin))
}

// An in-app navigation brings no new server response, so the head has to be updated here. The
// server still renders the head for the first load, which is the one a crawler reads.
export function syncPageMetadata(router) {
  router.afterEach((to) => applyPageMetadata(to.path))
}
