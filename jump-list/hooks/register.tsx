import type { EngineInterface, Register, Timer } from 'claude-code'

import { addPrompt, type Entry, isPrompt, jumpTarget, label, mark, seeRow } from './entries'
import { createParser, parseTranscript, projectDirName, textOf, type TranscriptRows } from './transcript'

const PANE = 'jump-list'
const PANE_COLUMNS = 36
const REDRAW_DELAY_MS = 60
const SETTLE_TRIES = 4
const WALK_SETTLE_MS = 150
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const entries: Entry[] = []
const volatileIds = new Set<string>()
const checkedRows = new Set<string>()
const matchedRows = new Set<string>()
let endId: string | undefined
let endLineId: string | undefined
let isAwaitingEndLine = true
const seenEndLines = new Set<string>()
let historySource = 'not loaded'
let isCollapsed = false
let isReseating = false

async function setCollapsed($: EngineInterface, collapsed: boolean) {
  isCollapsed = collapsed
  isReseating = true
  if (collapsed) await $.ui.close({ id: PANE })
  else await $.ui.open({ id: PANE, title: 'Jumps', columns: PANE_COLUMNS })
  isReseating = false
  $.ui.invalidate('ui.render')
}
let pendingRedraw: Timer | undefined

function scheduleRedraw($: EngineInterface) {
  if (pendingRedraw !== undefined) return
  pendingRedraw = $.clock.after(REDRAW_DELAY_MS, () => {
    pendingRedraw = undefined
    $.ui.invalidate('ui.render')
  })
}

function nearestKnown(index: number): { id: string; isAfter: boolean } | undefined {
  for (let distance = 1; distance < entries.length; distance += 1) {
    const after = entries[index + distance]
    if (after?.rowId !== undefined) return { id: after.rowId, isAfter: true }
    const before = entries[index - distance]
    if (before?.rowId !== undefined) return { id: before.rowId, isAfter: false }
  }
  return undefined
}

async function jump($: EngineInterface, index: number) {
  const target = entries[index]
  if (target === undefined) return
  if (target.rowId !== undefined) {
    await $.ui.scroll({ to: { requestId: target.rowId }, block: 'start' })
    return
  }
  const rough = target.uuid ?? nearestKnown(index)?.id
  if (rough === undefined) {
    $.ui.toast('Scroll up once so this prompt is drawn, then click again')
    return
  }
  const isAfter = target.uuid === undefined && nearestKnown(index)?.isAfter === true
  await $.ui.scroll({ to: { requestId: rough }, block: isAfter ? 'end' : 'start' })
  for (let wait = 0; wait < SETTLE_TRIES; wait += 1) {
    await $.clock.sleep(WALK_SETTLE_MS)
    if (target.rowId !== undefined) {
      await $.ui.scroll({ to: { requestId: target.rowId }, block: 'start' })
      return
    }
  }
  $.ui.toast('Getting closer: click again to land exactly')
}

async function jumpToEnd($: EngineInterface) {
  const target = endLineId ?? endId
  if (target === undefined) {
    $.ui.toast('No answer yet to jump to')
    return
  }
  await $.ui.scroll({ to: { requestId: target }, block: 'end' })
}

async function findTranscript($: EngineInterface): Promise<string | undefined> {
  const id = await $.session.id()
  const home = await $.env.get('HOME')
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home === undefined ? undefined : `${home}/.claude`)
  if (configDir === undefined) return undefined
  const projects = `${configDir}/projects`
  for (const dir of [await $.session.cwd(), await $.session.root()]) {
    const path = `${projects}/${projectDirName(dir)}/${id}.jsonl`
    if (await $.fs.exists(path)) return path
  }
  for (const entry of await $.fs.list(projects)) {
    const path = `${projects}/${entry.name}/${id}.jsonl`
    if (entry.kind === 'dir' && (await $.fs.exists(path))) return path
  }
  return undefined
}

async function readRows($: EngineInterface, path: string): Promise<{ rows: TranscriptRows; how: string }> {
  try {
    return { rows: parseTranscript(await $.fs.read(path), isPrompt), how: 'read' }
  } catch {
    const parser = createParser(isPrompt)
    for await (const chunk of $.process.spawn({ argv: ['cat', path] })) {
      if (chunk.stream === 'stdout') parser.push(chunk.text)
    }
    return { rows: parser.finish(), how: 'streamed' }
  }
}

async function seed($: EngineInterface, knownPath?: string) {
  entries.length = 0
  isAwaitingEndLine = true
  endId = undefined
  endLineId = undefined
  try {
    const path = knownPath ?? (await findTranscript($))
    if (path === undefined) throw new Error('transcript not found')
    const { rows, how } = await readRows($, path)
    for (const prompt of rows.prompts) addPrompt(entries, prompt.text, prompt.uuid, prompt.at)
    endId = rows.lastAnswer
    historySource = `transcript (${how}), ${rows.prompts.length} prompts`
  } catch (error) {
    for (const message of await $.session.messages()) {
      if (message.role === 'user') addPrompt(entries, message.text)
    }
    historySource = `history without ids (${String(error).slice(0, 60)})`
  }
  scheduleRedraw($)
}

export const register: Register = (on, options) => {
  const openOnStart = options.open_on_start !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'jumps', description: 'Open the jump list: every prompt in this session, click to jump' })
    await seed($)
    if (openOnStart) void $.ui.open({ id: PANE, title: 'Jumps', columns: PANE_COLUMNS })
    return next(e)
  })

  on('command.run', { command: 'jumps' }, async $ => {
    isCollapsed = false
    const opened = await $.ui.open({ id: PANE, title: 'Jumps', columns: PANE_COLUMNS })
    const status = opened.isPlaced ? 'Jump list opened.' : `Jump list could not open: ${opened.reason}`
    return { text: `${status}\nHistory: ${historySource}. Row ids matching transcript ids: ${matchedRows.size}/${checkedRows.size}.` }
  })

  on('session.append', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && result.uuid !== undefined) {
      const text = textOf(result.message.content)
      if (e.door === 'prompt' && e.message.isMeta !== true && addPrompt(entries, text, result.uuid, await $.clock.now())) scheduleRedraw($)
      if (e.door === 'response' && text.trim() !== '') endId = result.uuid
    }
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const id = e.requestId
    if (id !== undefined && !volatileIds.has(id) && e.props.origin.kind === 'composer') {
      if (isPrompt(e.props.text)) {
        checkedRows.add(id)
        if (entries.some(entry => entry.uuid === id)) matchedRows.add(id)
      }
      const isVisible = e.props.onScreen === undefined ? undefined : e.props.onScreen !== null
      const result = seeRow(entries, id, e.props.text, isVisible)
      if (result === 'volatile') {
        volatileIds.add(id)
        checkedRows.delete(id)
        matchedRows.delete(id)
      }
      if (result !== 'unchanged' && result !== 'unknown') scheduleRedraw($)
    }
    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    await seed($, e.transcript_path)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE && e.origin.kind === 'person' && !isReseating) $.ui.toast('Jump list closed. Type /jumps to open it again')
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) isAwaitingEndLine = true
    return next(e)
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const id = e.requestId
    if (id !== undefined && !seenEndLines.has(id)) {
      seenEndLines.add(id)
      if (isAwaitingEndLine) {
        endLineId = id
        isAwaitingEndLine = false
      }
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const tool = String(e.tool)
    const changed =
      (EDIT_TOOLS.has(tool) && result.isError !== true && mark(entries, 'edit')) ||
      (tool === 'Bash' && result.isError === true && mark(entries, 'fail'))
    if (changed) scheduleRedraw($)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isCollapsed || e.props.hasSurvey) return next(e)
    const { Button } = $.ui.resolve(e)
    return <Button key="expand" label={`› Jumps (${entries.length})`} plain dimColor onPress={() => void setCollapsed($, false)} />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const width = Math.max(12, e.props.bodyColumns)
    const isFullscreen = e.viewport?.isFullscreen

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="flex-end" paddingRight={1}>
          <Button key="collapse" label="–" plain dimColor onPress={() => void setCollapsed($, true)} />
        </Box>
        {isFullscreen === false && <Text dimColor>Not fullscreen: no position or jumps.</Text>}
        {entries.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {entries.map((entry, i) => (
          <Button
            key={`jump-${i}`}
            label={label(entry, width)}
            plain
            dimColor={entry.isVisible !== true}
            onPress={() => void jump($, i)}
          />
        ))}
        {entries.length > 0 && <Button key="jump-end" label="↓ end" plain onPress={() => void jumpToEnd($)} />}
      </Box>
    )
  })
}
