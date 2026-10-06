import { expect, test } from 'claude-code/testing'

const FACTS = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['terminal'] as const,
  tools: [],
  outputStyle: null,
  traits: [],
}

test('appends the copy instruction as the last session section', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(FACTS)
  const last = sections.at(-1)
  expect(sections[0]?.id).toBe('intro')
  expect(last?.id).toBe('reply-tools:instruction')
  expect(last?.scope).toBe('session')
  expect(last?.text).toContain('```text')
})

test('the instruction toggle off leaves the system prompt alone', { options: { copy_instruction: false } }, async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(FACTS)
  expect(sections.map(s => s.id)).toEqual(['intro'])
})
