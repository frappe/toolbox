export const hsnDependencyApiPattern = '**/api/method/toolbox.hsn_dependency.get_dependency_status*'
export const hsnCatalogApiPattern = '**/api/method/toolbox.hsn_catalog.get_hsn_catalog*'
export const hsnInstallApiPattern = '**/api/method/toolbox.hsn_dependency.install_india_compliance*'

export const blockedHsnDependency = {
  schemaVersion: 1,
  state: 'blocked',
  title: 'India Compliance is required',
  message: 'Ask a System Manager to install ERPNext and India Compliance on this site.',
  canInstall: false,
}

export const readyHsnDependency = {
  schemaVersion: 1,
  state: 'ready',
  title: 'India Compliance is ready',
  message: 'Search uses the site master.',
  canInstall: false,
  contract: {
    compatible: true,
    missingStatutoryFields: ['gstRate', 'cess', 'effectiveDate', 'statutorySource'],
  },
}

export const hsnCatalog = {
  schemaVersion: 1,
  revision: 'a'.repeat(64),
  sourceVersion: '17.1.0',
  sourceModifiedAt: '2026-07-31T12:00:00+00:00',
  recordCount: 4,
  notModified: false,
  records: [
    { code: '0101', description: 'Live horses, asses, mules and hinnies' },
    { code: '09012120', description: 'Roasted coffee, not decaffeinated' },
    { code: '998313', description: 'Information technology consulting and support services' },
    { code: '998314', description: 'Information technology design and development services' },
  ],
  source: {
    name: 'India Compliance GST HSN Code',
    url: 'https://github.com/resilient-tech/india-compliance/tree/develop/india_compliance/gst_india/doctype/gst_hsn_code',
  },
}

export async function mockHsnDependency(page, dependency = blockedHsnDependency) {
  await page.route(hsnDependencyApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: dependency }) }),
  )
}

export async function mockHsnReady(page) {
  await mockHsnDependency(page, readyHsnDependency)
  await page.route(hsnCatalogApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: hsnCatalog }) }),
  )
}
