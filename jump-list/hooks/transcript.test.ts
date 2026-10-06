import { expect, test } from 'claude-code/testing'

import { isPrompt } from './entries'
import { createParser, parseTranscript, projectDirName } from './transcript'

const line = (row: object) => JSON.stringify(row)

test('prompts come out in file order with their uuids; meta, sidechain and commands are skipped', async () => {
  const jsonl = [
    line({ type: 'user', uuid: 'u1', timestamp: '2026-10-06T15:42:00.000Z', message: { role: 'user', content: 'asdasda' } }),
    line({ type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'text', text: 'Invalid premise' }] } }),
    line({ type: 'user', uuid: 'm1', isMeta: true, message: { role: 'user', content: 'caveat' } }),
    line({ type: 'user', uuid: 'c1', message: { role: 'user', content: '<command-name>/reload-plugins</command-name>' } }),
    line({ type: 'user', uuid: 't1', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } }),
    line({ type: 'user', uuid: 's1', isSidechain: true, message: { role: 'user', content: 'subagent prompt' } }),
    line({ type: 'user', uuid: 'u2', message: { role: 'user', content: [{ type: 'text', text: 'give me lorem' }] } }),
    line({ type: 'assistant', uuid: 'a2', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash' }] } }),
    line({ type: 'assistant', uuid: 'a3', message: { role: 'assistant', content: [{ type: 'text', text: 'Lorem ipsum' }] } }),
    'not json',
    '',
  ].join('\n')
  const rows = parseTranscript(jsonl, isPrompt)
  expect(rows.prompts).toEqual([
    { uuid: 'u1', text: 'asdasda', at: Date.parse('2026-10-06T15:42:00.000Z') },
    { uuid: 'u2', text: 'give me lorem', at: undefined },
  ])
  expect(rows.lastAnswer).toBe('a3')
})

test('streamed chunks that split lines anywhere give the same rows as one read', async () => {
  const jsonl = [
    line({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'first prompt' } }),
    line({ type: 'user', uuid: 'r1', message: { role: 'user', content: '[Request interrupted by user]' } }),
    line({ type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] } }),
    line({ type: 'user', uuid: 'u2', message: { role: 'user', content: 'second prompt' } }),
  ].join('\n')
  const parser = createParser(isPrompt)
  for (let i = 0; i < jsonl.length; i += 7) parser.push(jsonl.slice(i, i + 7))
  const streamed = parser.finish()
  expect(streamed).toEqual(parseTranscript(jsonl, isPrompt))
  expect(streamed.prompts.map(p => p.uuid)).toEqual(['u1', 'u2'])
  expect(streamed.lastAnswer).toBe('a1')
})

test('project folder names replace every non-alphanumeric character with a dash', async () => {
  expect(projectDirName('/home/dev')).toBe('-home-dev')
  expect(projectDirName('/home/dev/projects/my-app')).toBe('-home-dev-projects-my-app')
})
