import { expect, test } from 'claude-code/testing'

const LONG = ['Intro line.', '```bash', 'npm i', '```', ...Array(20).fill('More prose.')].join('\n')

test('a long reply with code draws copy and tl;dr buttons on the terminal', async $ => {
  const ui = await $.ui.mount({
    plugin: 'reply-tools',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-1',
    props: { text: LONG, isFirstOfReply: true },
  })
  expect(await ui.find({ key: 'copy-1' })).toBeDefined()
  expect(await ui.find({ key: 'tldr' })).toBeDefined()
  expect(await ui.find({ key: 'simpler' })).toBeUndefined()
  await ui.unmount()
})

test('the tl;dr button stays hidden when toggled off', { options: { tldr_button: false } }, async $ => {
  const ui = await $.ui.mount({
    plugin: 'reply-tools',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'msg-2',
    props: { text: LONG, isFirstOfReply: true },
  })
  expect(await ui.find({ key: 'copy-1' })).toBeDefined()
  expect(await ui.find({ key: 'tldr' })).toBeUndefined()
  await ui.unmount()
})
