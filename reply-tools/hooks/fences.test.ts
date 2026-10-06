import { expect, test } from 'claude-code/testing'

import { codeBlocks, splitFences } from './fences'

test('splits prose and closed fences, numbering code blocks', async () => {
  const text = 'Run this:\n```bash\nls -la\ncd /tmp\n```\nThen read the docs, they explain it.\nMore prose here.\nAnd a third line.\n~~~\nx\n~~~'
  const segments = splitFences(text)
  expect(segments.map(s => s.kind)).toEqual(['prose', 'code', 'prose', 'code'])
  const blocks = codeBlocks(text)
  expect(blocks[0]).toMatchObject({ code: 'ls -la\ncd /tmp', language: 'bash', index: 1 })
  expect(blocks[1]).toMatchObject({ code: 'x', language: '', index: 2 })
})

test('an unclosed fence stays prose', async () => {
  expect(codeBlocks('text\n```py\nprint(1)')).toEqual([])
})

test('a longer fence holds a shorter one', async () => {
  const blocks = codeBlocks('````md\n```js\na\n```\n````')
  expect(blocks.length).toBe(1)
  expect(blocks[0]?.code).toBe('```js\na\n```')
})

test('shell blocks split by short text form one group on the first block', async () => {
  const text = '```bash\nnpm i\n```\nThen:\n```sh\nnpm test\n```\n\n```zsh\nnpm run build\n```'
  const blocks = codeBlocks(text)
  expect(blocks[0]?.group).toEqual({ code: 'npm i\nnpm test\nnpm run build', size: 3 })
  expect(blocks[1]?.group).toBeUndefined()
  expect(blocks[2]?.group).toBeUndefined()
})

test('long text or a non-shell block breaks a group', async () => {
  const long = '```bash\na\n```\none\ntwo\nthree\n```bash\nb\n```'
  expect(codeBlocks(long).every(b => b.group === undefined)).toBe(true)

  const mixed = '```bash\na\n```\n```text\nmsg\n```\n```bash\nb\n```'
  expect(codeBlocks(mixed).every(b => b.group === undefined)).toBe(true)
})

test('a lone shell block has no group', async () => {
  expect(codeBlocks('```bash\nls\n```')[0]?.group).toBeUndefined()
})
