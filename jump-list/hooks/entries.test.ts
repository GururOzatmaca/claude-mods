import { expect, test } from 'claude-code/testing'

import { addPrompt, attachUuid, clockTime, type Entry, jumpTarget, label, mark, seeRow } from './entries'

const fromHistory = (...texts: string[]) => {
  const entries: Entry[] = []
  for (const t of texts) addPrompt(entries, t)
  return entries
}

test('history order is kept and slash commands or wrapped rows are skipped', async () => {
  const entries = fromHistory('in here 10', 'asdasda', '/reload-plugins', '<command-name>x</command-name>', '', 'give me lorem')
  expect(entries.map(e => e.text)).toEqual(['in here 10', 'asdasda', 'give me lorem'])
})

test('a pasted prompt is kept and its label shows the pasted text', async () => {
  const entries = fromHistory('\n\n<pasted_content id="7718">\nThe taxes should not be compounded.\n</pasted_content>\nis this done?')
  expect(entries).toHaveLength(1)
  expect(label(entries[0]!, 40)).toBe('The taxes should not be compounded. is …')
  expect(seeRow(entries, 'row', 'The taxes should not be compounded.\nis this done?', true)).toBe('matched')
})

test('rows drawn bottom-up still keep the list in history order', async () => {
  const entries = fromHistory('a', 'b', 'c')
  expect(seeRow(entries, 'id-c', 'c', true)).toBe('matched')
  expect(seeRow(entries, 'id-b', 'b', false)).toBe('matched')
  expect(seeRow(entries, 'id-a', 'a', false)).toBe('matched')
  expect(entries.map(e => e.rowId)).toEqual(['id-a', 'id-b', 'id-c'])
})

test('a row whose id equals a transcript uuid goes to that exact prompt, even among duplicates', async () => {
  const entries: Entry[] = []
  addPrompt(entries, 'in here 10', 'u-old')
  addPrompt(entries, 'asdasda', 'u-mid')
  addPrompt(entries, 'in here 10', 'u-new')
  expect(seeRow(entries, 'u-old', 'in here 10', true)).toBe('matched')
  expect(entries[0]?.rowId).toBe('u-old')
  expect(entries[2]?.rowId).toBeUndefined()
})

test('without uuids a duplicate drawn first goes to the newest unmatched copy', async () => {
  const entries = fromHistory('in here 10', 'asdasda', 'in here 10')
  seeRow(entries, 'newest', 'in here 10', true)
  expect(entries[2]?.rowId).toBe('newest')
})

test('a row that changes text under one id is released as volatile', async () => {
  const entries = fromHistory('a', 'b')
  seeRow(entries, 'sticky', 'b', true)
  expect(seeRow(entries, 'sticky', 'a', true)).toBe('volatile')
  expect(entries[1]?.rowId).toBeUndefined()
})

test('live prompts get their uuid from the append, newest unmatched copy first', async () => {
  const entries = fromHistory('a', 'b', 'a')
  expect(attachUuid(entries, 'a', 'u9')).toBe(true)
  expect(entries[2]?.uuid).toBe('u9')
  expect(jumpTarget(entries[2] as Entry)).toBe('u9')
  entries[2]!.rowId = 'r9'
  expect(jumpTarget(entries[2] as Entry)).toBe('r9')
})

test('marks land on the newest prompt once', async () => {
  const entries = fromHistory('x', 'y')
  expect(mark(entries, 'edit')).toBe(true)
  expect(mark(entries, 'edit')).toBe(false)
  expect(entries[1]?.marks.has('edit')).toBe(true)
  expect(entries[0]?.marks.size).toBe(0)
})

test('labels show the send time, marks, and truncate to the width', async () => {
  const at = new Date(2026, 9, 6, 18, 42, 7).getTime()
  const entry: Entry = { text: 'fix the cart\nprice bug on staging please', at, marks: new Set(['edit', 'fail']), isVisible: true }
  expect(label(entry, 80)).toBe('18:42 ✎✗ fix the cart price bug on staging please')
  const short = label(entry, 20)
  expect(short.length).toBeLessThanOrEqual(20)
  expect(short.endsWith('…')).toBe(true)
})

test('a prompt with no known time shows just its text', async () => {
  expect(clockTime(new Date(2026, 0, 1, 9, 5).getTime())).toBe('09:05')
  expect(label({ text: 'no time here', marks: new Set(), isVisible: false }, 40)).toBe('no time here')
})
