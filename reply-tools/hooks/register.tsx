import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import { codeBlocks, isShell, splitFences } from './fences'
import { isLong, questionFor, TLDR_MODEL, TLDR_SYSTEM, tldrPrompt } from './simplify'

const INSTRUCTION = [
  'Copyable output: the user has a copy button on every fenced code block in your replies.',
  'Put anything the user is meant to copy and paste (shell commands, scripts, config, emails, chat messages, commit messages, text to send) inside a fenced code block.',
  'Use a language tag for code (```bash, ```ts) and ```text for messages and prose meant to be sent.',
  'Put commands the user runs in sequence in one ```bash block rather than splitting them, unless an explanation must sit between steps.',
  'Do not fence text that is not meant to be copied.',
].join(' ')

const SELECTION_SETTLE_MS = 350
const TLDR_TIMEOUT_MS = 30000
const TLDR_MAX_TOKENS = 1000

type View = 'original' | 'tldr'
type ReplyState = { view: View; isLoading: boolean; tldr?: string }

const replies = new Map<string, ReplyState>()

const lineCount = (code: string) => code.split('\n').length

function stateOf(id: string): ReplyState {
  const found = replies.get(id)
  if (found !== undefined) return found
  const fresh: ReplyState = { view: 'original', isLoading: false }
  replies.set(id, fresh)
  return fresh
}

async function copyAfterClick($: EngineInterface, code: string, surface: RenderSurface) {
  await $.ui.copy({ text: code, surface })
  await $.clock.sleep(SELECTION_SETTLE_MS)
  return copy($, code, surface)
}

async function copy($: EngineInterface, code: string, surface?: RenderSurface) {
  const result = await $.ui.copy({ text: code, surface })
  const lines = lineCount(code)
  $.ui.toast(
    result.isCopied
      ? `Copied ${lines} line${lines === 1 ? '' : 's'}`
      : `Copy failed: ${result.reason}`,
  )
  return result.isCopied
}

async function showView($: EngineInterface, id: string, text: string, view: View) {
  const state = stateOf(id)
  if (view === 'original' || state.tldr !== undefined) {
    state.view = view
    $.ui.invalidate('ui.render')
    return
  }
  state.isLoading = true
  $.ui.invalidate('ui.render')
  const messages = (await $.session.messages()).map(m => ({ role: m.role, text: m.text }))
  const result = await $.model.complete({
    model: TLDR_MODEL,
    system: TLDR_SYSTEM,
    prompt: tldrPrompt(questionFor(messages, text), text),
    maxTokens: TLDR_MAX_TOKENS,
    timeoutMs: TLDR_TIMEOUT_MS,
  })
  state.isLoading = false
  if (result.isAnswered && result.text.trim() !== '') {
    state.tldr = result.text.trim()
    state.view = 'tldr'
  } else {
    $.ui.toast(`tl;dr failed: ${result.isAnswered ? 'empty reply' : result.reason}`)
  }
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  const copyButtons = options.copy_buttons !== false
  const copyInstruction = options.copy_instruction !== false
  const tldrButton = options.tldr_button !== false

  if (copyInstruction) {
    on('prompt.compose', async ($, e, next) => {
      const composed = await next(e)
      return {
        sections: [...composed.sections, { id: 'reply-tools:instruction', text: INSTRUCTION, scope: 'session' }],
      }
    })
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cb',
      description: 'Copy code block N of the last reply; "all" joins every shell block; no N lists them',
      argumentHint: '[n|all]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'cb' }, async ($, e) => {
    const messages = await $.session.messages()
    const last = [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && codeBlocks(m.text).length > 0)
    if (last === undefined) return { text: 'No code blocks in recent replies.' }

    const blocks = codeBlocks(last.text)
    const arg = String(e.args ?? '').trim()

    if (arg === 'all') {
      const shell = blocks.filter(b => isShell(b.language))
      if (shell.length === 0) return { text: 'No shell blocks in the last reply.' }
      await copy($, shell.map(b => b.code).join('\n'))
      return { text: `Copied ${shell.length} shell block${shell.length === 1 ? '' : 's'}.` }
    }

    const n = Number.parseInt(arg, 10)

    if (Number.isNaN(n)) {
      const only = blocks.length === 1 ? blocks[0] : undefined
      if (only !== undefined) {
        await copy($, only.code)
        return { text: 'Copied code block 1.' }
      }
      const list = blocks
        .map(b => `${b.index}. ${b.language || 'text'}: ${(b.code.split('\n')[0] ?? '').slice(0, 60)}`)
        .join('\n')
      return { text: `Code blocks in the last reply:\n${list}\nRun /cb N to copy one, /cb all for every shell block.` }
    }

    const block = blocks.find(b => b.index === n)
    if (block === undefined) return { text: `No block ${n}. The last reply has ${blocks.length}.` }
    await copy($, block.code)
    return { text: `Copied code block ${n}.` }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const original = e.props.text
    const id = e.requestId
    const canSummarize = tldrButton && id !== undefined && isLong(original)
    const state = canSummarize ? stateOf(id) : undefined
    const shown = state?.view === 'tldr' && state.tldr !== undefined ? state.tldr : original

    const segments = copyButtons ? splitFences(shown) : [{ kind: 'prose' as const, text: shown }]
    const hasCode = segments.some(s => s.kind === 'code')
    if (!hasCode && state === undefined) return next(e)

    const { Box, Button, Markdown, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {segments.map((s, i) =>
          s.kind === 'prose' ? (
            <Markdown key={`p${i}`} text={s.text} />
          ) : (
            <Box key={`c${i}`} flexDirection="column">
              <Box flexDirection="row" gap={2}>
                <Button
                  key={`copy-${s.index}`}
                  label={`⧉ copy ${s.index}`}
                  plain
                  dimColor
                  onPress={press => void copyAfterClick($, s.code, press.surface)}
                />
                {s.group !== undefined && (
                  <Button
                    key={`copy-all-${s.index}`}
                    label={`⧉ copy all ${s.group.size}`}
                    plain
                    onPress={press => void copyAfterClick($, s.group?.code ?? s.code, press.surface)}
                  />
                )}
              </Box>
              <Markdown key={`m${i}`} text={s.raw} />
            </Box>
          ),
        )}
        {state !== undefined && id !== undefined && (
          <Box key="tldr-row" flexDirection="row" gap={2}>
            {state.isLoading ? (
              <Text dimColor>Summarizing...</Text>
            ) : state.view === 'original' ? (
              <Button key="tldr" label="↓ tl;dr" plain dimColor onPress={() => void showView($, id, original, 'tldr')} />
            ) : (
              <>
                <Text dimColor>tl;dr ·</Text>
                <Button key="original" label="↑ original" plain dimColor onPress={() => void showView($, id, original, 'original')} />
              </>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
