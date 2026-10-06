import { expect, test } from 'claude-code/testing'

import { buildPrompt, parseTrigger, systemFor } from './rules'

test('prefix picks model and mode', async () => {
  expect(parseTrigger('++ x')).toEqual({ model: 'haiku', mode: 'clean', raw: 'x' })
  expect(parseTrigger('++o x')).toEqual({ model: 'opus', mode: 'clean', raw: 'x' })
  expect(parseTrigger('++q x')).toEqual({ model: 'haiku', mode: 'ask', raw: 'x' })
  expect(parseTrigger('++oq x')).toEqual({ model: 'opus', mode: 'ask', raw: 'x' })
  expect(parseTrigger('++qo x')).toEqual({ model: 'opus', mode: 'ask', raw: 'x' })
})

test('clean mode only fixes wording, ask mode structures with questions', async () => {
  expect(systemFor('clean')).toContain('Fix the wording only')
  expect(systemFor('clean')).not.toContain('Open questions')
  expect(systemFor('clean')).not.toContain('Assumptions')
  expect(systemFor('ask')).toContain('Open questions (ask me before starting)')
  expect(systemFor('ask')).not.toContain('Assumptions')
})

test('leading whitespace or newlines before ++ still trigger', async () => {
  expect(parseTrigger('\n++ fix it')).toEqual({ model: 'haiku', mode: 'clean', raw: 'fix it' })
  expect(parseTrigger('  \n\t++q fix it')).toEqual({ model: 'haiku', mode: 'ask', raw: 'fix it' })
})

test('a trailing ++ triggers the same modes', async () => {
  expect(parseTrigger('fix the cart price bug ++')).toEqual({ model: 'haiku', mode: 'clean', raw: 'fix the cart price bug' })
  expect(parseTrigger('fix it ++o')).toEqual({ model: 'opus', mode: 'clean', raw: 'fix it' })
  expect(parseTrigger('fix it\n++q  \n')).toEqual({ model: 'haiku', mode: 'ask', raw: 'fix it' })
  expect(parseTrigger('fix it ++oq')).toEqual({ model: 'opus', mode: 'ask', raw: 'fix it' })
})

test('the prefix wins when both ends have ++', async () => {
  expect(parseTrigger('++o fix it ++')).toEqual({ model: 'opus', mode: 'clean', raw: 'fix it ++' })
})

test('no marker, mid-text ++, a language name, or an empty body does not trigger', async () => {
  expect(parseTrigger('make a youtube clone')).toBeUndefined()
  expect(parseTrigger('use c++ for this')).toBeUndefined()
  expect(parseTrigger('should i learn c++')).toBeUndefined()
  expect(parseTrigger('rewrite it in c++o')).toBeUndefined()
  expect(parseTrigger('++')).toBeUndefined()
  expect(parseTrigger('++   ')).toBeUndefined()
  expect(parseTrigger('++once more')).toBeUndefined()
})

test('prompt keeps the last 6 non-empty messages, trimmed', async () => {
  const history = Array.from({ length: 9 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    text: i === 8 ? '' : `m${i}`,
  }))
  const prompt = buildPrompt('fix it', history)
  expect(prompt).not.toContain('m1\n')
  expect(prompt).toContain('USER: m2')
  expect(prompt).toContain('ASSISTANT: m7')
  expect(prompt).toContain('<request>\nfix it\n</request>')
})

test('empty history says so', async () => {
  expect(buildPrompt('x', [])).toContain('No prior conversation.')
})
