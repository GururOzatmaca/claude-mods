import { expect, test } from 'claude-code/testing'

import { isLong, MAX_WORDS, MIN_LINES, questionFor, TLDR_MODEL, TLDR_SYSTEM } from './simplify'

test('only replies of MIN_LINES or more count as long', async () => {
  expect(isLong(Array(MIN_LINES - 1).fill('x').join('\n'))).toBe(false)
  expect(isLong(Array(MIN_LINES).fill('x').join('\n'))).toBe(true)
})

test('tl;dr runs on sonnet with a hard word cap and keeps steps, statuses and conditions', async () => {
  expect(TLDR_MODEL).toBe('sonnet')
  expect(TLDR_SYSTEM).toContain(`At most ${MAX_WORDS} words`)
  expect(TLDR_SYSTEM).toContain('at most 5 bullets')
  expect(TLDR_SYSTEM).toContain('not deployed, not tested')
  expect(TLDR_SYSTEM).toContain('removed rather than stopped')
  expect(TLDR_SYSTEM).toContain('No headings')
})

test('the question is the user message before the matching reply', async () => {
  const messages = [
    { role: 'user' as const, text: 'old question' },
    { role: 'assistant' as const, text: 'old answer' },
    { role: 'user' as const, text: 'whats oop' },
    { role: 'assistant' as const, text: '' },
    { role: 'assistant' as const, text: 'OOP is a way to organize code around objects. More text.' },
    { role: 'user' as const, text: 'newer question' },
  ]
  expect(questionFor(messages, 'OOP is a way to organize code around objects.')).toBe('whats oop')
  expect(questionFor(messages, 'not in the transcript')).toBe('')
})
