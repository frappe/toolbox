export const hsnStatusApiPattern = '**/api/method/toolbox.hsn.get_dataset_status*'
export const hsnSearchApiPattern = '**/api/method/toolbox.hsn.search_hsn*'

export const hsnStatus = {
  hsn: {
    version: '2024-06-25',
    sourceUpdatedAt: '2024-06-25',
    recordCount: 18687,
    source: {
      name: 'CBIC GST HSN/SAC classification via India Compliance',
      url: 'https://github.com/resilient-tech/india-compliance',
      license: 'GNU General Public License v3',
      attribution: 'HSN and SAC codes from the CBIC GST classification, compiled by the India Compliance project (GPLv3).',
    },
  },
}

const RECORDS = [
  { code: '9983', code_type: 'SAC', description: 'Other professional, technical and business services' },
  { code: '998313', code_type: 'SAC', description: 'Information technology consulting and support services' },
  { code: '998314', code_type: 'SAC', description: 'Information technology design and development services' },
  { code: '0101', code_type: 'HSN', description: 'Live horses, asses, mules and hinnies' },
]

export async function mockHsnAvailable(page, { records = RECORDS } = {}) {
  await page.route(hsnStatusApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: hsnStatus }) }),
  )
  await page.route(hsnSearchApiPattern, (route) => {
    const query = (new URL(route.request().url()).searchParams.get('query') || '').toLowerCase()
    const results = records.filter(
      (record) => record.code.startsWith(query) || record.description.toLowerCase().includes(query),
    )
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: { schemaVersion: 1, state: 'ready', version: '2024-06-25', results } }),
    })
  })
}

export async function mockHsnUnavailable(page) {
  await page.route(hsnStatusApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: { hsn: null } }) }),
  )
}
