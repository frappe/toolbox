import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { lookup } from '@/tools/dictionary/api'
import DictionaryView from './DictionaryView.vue'

vi.mock('@/tools/dictionary/api', () => ({
  lookup: vi.fn(),
  suggest: vi.fn(() => Promise.resolve([])),
  getDatasetStatus: vi.fn(() => Promise.resolve({ schemaVersion: 1, dictionary: null })),
}))

// Shortened senses of "quiet". Three noun senses, and words that repeat across them.
const QUIET = {
  schemaVersion: 1,
  state: 'ready',
  word: 'quiet',
  senses: [
    { pos: 'noun', definition: 'a disposition free from stress', examples: [], synonyms: ['repose', 'serenity'] },
    { pos: 'noun', definition: 'the absence of sound', examples: [], synonyms: ['silence', 'repose'] },
    { pos: 'verb', definition: 'become quiet', examples: [], synonyms: ['hush'] },
  ],
  source: null,
  sourceUpdatedAt: '',
}

async function lookUp(response) {
  lookup.mockResolvedValue(response)
  const wrapper = mount(DictionaryView, { attachTo: document.body })
  await wrapper.get('input').setValue(response.word)
  await wrapper.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve))
  return wrapper
}

describe('the synonyms of a word', () => {
  it('gathers every sense into one list for each part of speech', async () => {
    const wrapper = await lookUp(QUIET)
    const section = wrapper.get('section[aria-labelledby="dictionary-synonyms-heading"]')
    const words = section.findAll('button').map((button) => button.text())

    // Two noun senses and one verb sense become two lists, and "repose" appears once.
    expect(words).toEqual(['repose', 'serenity', 'silence', 'hush'])
    expect(section.text()).toContain('Noun')
    expect(section.text()).toContain('Verb')
  })

  it('keeps the per-sense lists, which say which meaning a word belongs to', async () => {
    const wrapper = await lookUp(QUIET)

    // The question this section answers is not the one the gathered list answers.
    expect(wrapper.text()).toContain('the absence of sound')
    expect(wrapper.findAll('button').filter((button) => button.text() === 'silence').length).toBe(2)
  })

  it('says so for a word WordNet records no synonyms for', async () => {
    const wrapper = await lookUp({
      ...QUIET,
      word: 'aardwolf',
      senses: [{ pos: 'noun', definition: 'a striped hyena', examples: [], synonyms: [] }],
    })

    expect(wrapper.get('section[aria-labelledby="dictionary-synonyms-heading"]').text()).toContain(
      'WordNet records no synonyms for this word',
    )
  })

  it('tells a screen reader what the lookup returned', async () => {
    const wrapper = await lookUp(QUIET)

    expect(wrapper.get('[role="status"]').text()).toBe('quiet: 3 definitions, 4 synonyms.')
  })
})
