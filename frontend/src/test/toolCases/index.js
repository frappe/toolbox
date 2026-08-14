import { financialCases } from './financial'
import { healthCases } from './health'
import { indiaCases } from './india'
import { informationCases } from './information'
import { mediaCases } from './media'
import { standaloneCases } from './standalone'
import { timeCases } from './time'
import { unitConverterCases } from './unitConverters'

// What each tool should answer, and what a visitor should see when it does.
//
// Every expected figure comes from outside the application. The money and the rates were computed
// with Decimal in Python from the published formula, the conversion factors are the defining SI
// and NIST values, and the dictionary entries are rows in WordNet 3.1. Comparing a tool against
// its own engine would prove only that the engine is consistent with itself.
//
// The shape of a case:
//
//   name      what the case establishes, in the report and in the test title
//   fill      what a visitor does, in order. One of:
//               { label, value }        type into the input with this label
//               { select, option }      open this listbox and choose this option
//               { unit, pick }          open this unit picker and choose this unit
//               { click }               press the button or link with this name
//               { radio }               choose this radio
//   expect    what the page must then show:
//               primary                 the tool's headline result, exact string or pattern
//               contains                strings or patterns the result region must hold
//               value                   { label, is } for a result rendered as an input
//               alert                   the tool must refuse, with this message
//
// A tool with no case is a gap, and the QA report prints it as one rather than as a pass.
export const toolCases = [
  ...standaloneCases,
  ...financialCases,
  ...healthCases,
  ...unitConverterCases,
  ...timeCases,
  ...indiaCases,
  ...informationCases,
  ...mediaCases,
]

export const toolCasesById = new Map(toolCases.map((entry) => [entry.toolId, entry]))

export function casesFor(toolId) {
  return toolCasesById.get(toolId)?.cases || []
}
