import { mockCurrencyRates } from '../../../e2e/currency-fixture'

// Tools that own their whole page. The currency rates are mocked: this case establishes that the
// conversion arithmetic is right, and a live rate would make the expected figure change daily.
// Whether the real endpoint answers at all is the API contract layer's question, not this one.
export const standaloneCases = [
  {
    toolId: 'calculator',
    route: '/calculator',
    primary: { role: 'status', name: 'Calculation result' },
    cases: [
      {
        name: 'respects operator precedence and exponentiation',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: '(3 + 5) * 2 ^ 3' }],
        expect: { primary: '64' },
      },
      {
        name: 'a base ten logarithm',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: 'log(1000)' }],
        expect: { primary: '3' },
      },
      {
        name: 'trigonometry is in degrees, not radians',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: 'cos(60)' }],
        expect: { primary: '0.5' },
      },
      {
        name: 'pi to the precision the tool shows',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: 'pi' }],
        expect: { primary: /^3\.14159/ },
      },
      {
        name: 'refuses to divide by zero',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: '1 / 0' }],
        expect: { alert: /./ },
      },
      {
        name: 'refuses a square root of a negative number',
        fill: [{ role: 'textbox', label: 'Expression', submit: true, value: 'sqrt(-4)' }],
        expect: { alert: /sqrt/ },
      },
    ],
  },
  {
    toolId: 'gst-calculator',
    route: '/gst-calculator',
    cases: [
      {
        name: 'adds 18 percent and splits it evenly within a state',
        // 25,000 × 0.18 = 4,500. CGST and SGST take half each.
        fill: [{ label: 'Base amount', value: '25000' }],
        expect: { contains: ['₹29,500.00', '₹2,250.00'] },
      },
      {
        name: 'charges the whole rate as IGST between states',
        fill: [
          { label: 'Base amount', value: '25000' },
          { radio: 'Inter-state · IGST' },
        ],
        expect: { contains: ['₹4,500.00'] },
      },
      {
        name: 'removes the tax already inside a gross amount',
        // 59,000 / 1.18 = 50,000 exactly.
        fill: [
          { radio: 'Remove GST' },
          { label: 'GST-inclusive amount', value: '59000' },
        ],
        expect: { contains: ['₹50,000.00', '₹9,000.00'] },
      },
    ],
  },
  {
    toolId: 'currency-converter',
    route: '/currency-converter',
    fixture: mockCurrencyRates,
    cases: [
      {
        name: 'converts through the reference base',
        // The mocked rates are per euro: INR 100, USD 1.2. The pair opens on INR to USD, so
        // 2,500 INR is 25 EUR is 30 USD.
        fill: [{ label: 'Source amount', value: '2500' }],
        expect: { value: { label: 'Destination amount', is: '30' } },
      },
      {
        name: 'never calls the rates a live price',
        fill: [],
        expect: { absent: 'Live' },
      },
    ],
  },
]
