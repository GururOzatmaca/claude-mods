import type { EngineInterface, Register, Timer } from 'claude-code'

import { ORANGE } from './rainbow'
import { buildPrompt, parseTrigger, systemFor, triggerSpan } from './rules'

const TIMEOUT_MS = 30000
const MAX_TOKENS = 600
const BANNER = 'Prompt boosted!'
const NOTICE_MARKER = 'prompt-boost:boosted'
const DOT_MS = 400

let boosting: { model: string; dots: number; timer: Timer } | undefined

function startBoosting($: EngineInterface, model: string) {
  boosting?.timer.cancel()
  const timer = $.clock.every(DOT_MS, () => {
    if (boosting === undefined) return
    boosting.dots = (boosting.dots + 1) % 4
    $.ui.invalidate('ui.render')
  })
  boosting = { model, dots: 0, timer }
  $.ui.invalidate('ui.render')
}

function stopBoosting($: EngineInterface) {
  boosting?.timer.cancel()
  boosting = undefined
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  let last: { original: string; rewrite: string; model: string; seconds: number } | undefined

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (boosting === undefined || e.props.hasSurvey) return next(e)
    const { Text } = $.ui.resolve(e)
    return (
      <Text color={ORANGE}>
        Boosting prompt{'.'.repeat(boosting.dots)}
        <Text dimColor> ({boosting.model})</Text>
      </Text>
    )
  })

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const span = triggerSpan(box.text)
    if (span === undefined) return box
    return {
      ...box,
      decorations: [...(box.decorations ?? []), { start: span[0], end: span[1], color: ORANGE }],
    }
  })

  on('session.append', async ($, e, next) => {
    if (e.door !== 'notice') return next(e)
    const isBoostNotice = e.message.content.some(
      block => block.type === 'text' && String(block.text).includes(NOTICE_MARKER),
    )
    if (!isBoostNotice) return next(e)
    return next({ ...e, message: { ...e.message, content: [{ type: 'text', text: BANNER }] } })
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ap',
      description: 'prompt-boost: show the last rewrite; "undo" puts the original back in the prompt box',
      argumentHint: '[undo]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'ap' }, async ($, e) => {
    if (last === undefined) {
      return { text: 'No rewrite yet. Prefixes: ++ (clean wording, Haiku), ++o (clean, Opus), ++q (structured + questions), ++oq (Opus + questions).' }
    }
    if (String(e.args ?? '').trim() === 'undo') {
      await $.prompt.fill({ text: last.original })
      return { text: 'Original prompt restored to the box.' }
    }
    return {
      text: `Original:\n${last.original}\n\nRewrite (${last.model}, ${last.seconds}s):\n${last.rewrite}`,
    }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer') return next(e)
    const trigger = parseTrigger(e.text)
    if (trigger === undefined) return next(e)

    const started = await $.clock.now()
    startBoosting($, trigger.model)
    const history = (await $.session.messages()).map(m => ({ role: m.role, text: m.text }))
    const result = await $.model.complete({
      model: trigger.model,
      system: systemFor(trigger.mode),
      prompt: buildPrompt(trigger.raw, history),
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    })
    stopBoosting($)
    const seconds = Math.round(((await $.clock.now()) - started) / 100) / 10

    if (!result.isAnswered || result.text.trim() === '') {
      await $.prompt.fill({ text: trigger.raw })
      const reason = result.isAnswered ? 'empty reply' : result.reason
      return { drop: `prompt-boost: rewrite failed (${reason}). Original restored to the prompt box.` }
    }

    const rewrite = result.text.trim()
    last = { original: trigger.raw, rewrite, model: trigger.model, seconds }
    await $.prompt.fill({ text: rewrite })

    return { drop: NOTICE_MARKER }
  }).catch(async ($, e, next) => {
    const trigger = parseTrigger(e.text)
    if (trigger === undefined) return next(e)
    stopBoosting($)
    await $.prompt.fill({ text: trigger.raw })
    return { drop: 'prompt-boost: rewrite errored. Original restored to the prompt box.' }
  })
}
