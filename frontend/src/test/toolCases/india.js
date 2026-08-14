import { mockHsnAvailable } from '../../../e2e/hsn-fixture'

// These three read a server dataset. The cases here mock the endpoint, so they establish that a
// result renders the way it should. Whether the dataset itself holds the right rows is a different
// question, and `e2e/api-contract.spec.js` asks it against the real release.
export const indiaCases = [
  {
    toolId: 'hsn-sac-lookup',
    route: '/hsn-sac-lookup',
    fixture: mockHsnAvailable,
    cases: [
      {
        name: 'finds a service code and labels it SAC',
        fill: [{ search: '9983', submit: true }],
        expect: { contains: ['9983', 'SAC'] },
      },
      {
        name: 'finds a code from words in its description',
        fill: [{ search: 'horses', submit: true }],
        expect: { contains: ['0101'] },
      },
    ],
  },
  {
    toolId: 'pin-code-search',
    route: '/pin-code-search',
    cases: [
      {
        name: 'finds a post office by PIN code',
        // 110001 is the New Delhi GPO range. The figure comes from the Department of Posts
        // dataset, not from the tool.
        fill: [{ search: '110001', submit: true }],
        expect: { contains: [/New Delhi/i] },
      },
    ],
  },
  {
    toolId: 'ifsc-code-search',
    route: '/ifsc-code-search',
    cases: [
      {
        name: 'finds a branch by IFSC code',
        // SBIN0000001 is the State Bank of India code used throughout the RBI reference list.
        fill: [{ search: 'SBIN0000001', submit: true }],
        expect: { contains: [/State Bank of India/i] },
      },
    ],
  },
]
