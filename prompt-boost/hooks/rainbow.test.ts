import { expect, test } from 'claude-code/testing'

import { triggerSpan } from './rules'

test('trigger span covers the prefix and its flags, after leading space', async () => {
  expect(triggerSpan('++ fix it')).toEqual([0, 2])
  expect(triggerSpan('++oq fix')).toEqual([0, 4])
  expect(triggerSpan('  ++q x')).toEqual([2, 5])
  expect(triggerSpan('++')).toEqual([0, 2])
  expect(triggerSpan('c++ is fun')).toBeUndefined()
})

test('trigger span covers a trailing marker so it turns orange too', async () => {
  expect(triggerSpan('fix it ++')).toEqual([7, 9])
  expect(triggerSpan('fix it ++oq  ')).toEqual([7, 11])
  expect(triggerSpan('learn c++')).toBeUndefined()
})
