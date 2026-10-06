import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPrompt, systemFor } from '../prompt-boost/hooks/rules'
import { MAX_WORDS, TLDR_MODEL, TLDR_SYSTEM, tldrPrompt } from '../reply-tools/hooks/simplify'
import { boostCases, replyCases } from './cases'

const BOOST_MODEL = process.env.EVAL_MODEL ?? 'haiku'
const SUMMARY_MODEL = process.env.EVAL_MODEL ?? TLDR_MODEL
const CONCURRENCY = 4
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results')

type Check = { name: string; ok: boolean; detail?: string }
type Result = { suite: string; id: string; input: string; output: string; seconds: number; checks: Check[] }

function runClaude(model: string, system: string, prompt: string): Promise<{ output: string; seconds: number }> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--safe-mode', '--model', model, '--tools', '', '--no-session-persistence', '--output-format', 'text', '--system-prompt', system, prompt],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let out = ''
    let err = ''
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    child.on('close', code =>
      code === 0
        ? resolve({ output: out.trim(), seconds: (Date.now() - started) / 1000 })
        : reject(new Error(`claude exited ${code}: ${err.trim()}`)),
    )
  })
}

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const bullets = (s: string) => s.split('\n').filter(l => /^\s*[-*]\s/.test(l))
const hasHeading = (s: string) => s.split('\n').some(l => /^#{1,6}\s/.test(l))
const missing = (out: string, keep: string[]) => keep.filter(k => !out.toLowerCase().includes(k.toLowerCase()))

function boostChecks(input: string, output: string, keep: string[]): Check[] {
  const lost = missing(output, keep)
  const added = ['Assumptions', 'Open questions', 'Done when', 'Not in scope', 'Context:'].filter(s => output.includes(s))
  return [
    { name: 'keeps every name', ok: lost.length === 0, detail: lost.join(', ') },
    { name: 'adds no sections', ok: added.length === 0, detail: added.join(', ') },
    { name: 'no "the user"', ok: !/\bthe user\b/i.test(output) },
    { name: 'no code fences', ok: !output.includes('```') },
    { name: 'length <= 2.5x input', ok: output.length <= input.length * 2.5, detail: `${output.length} vs ${input.length}` },
  ]
}

const withoutCode = (s: string) => s.replace(/```[\s\S]*?```/g, '')

function tldrChecks(output: string, keep: string[]): Check[] {
  const prose = withoutCode(output)
  const list = bullets(prose)
  const longBullets = list.filter(b => words(b.replace(/^\s*[-*]\s/, '')) > 20)
  const firstLine = output.split('\n').find(l => l.trim() !== '') ?? ''
  const lost = missing(output, keep)
  return [
    { name: 'no heading', ok: !hasHeading(output) },
    { name: 'opens with a sentence, not a bullet', ok: !/^\s*[-*]\s/.test(firstLine) },
    { name: 'at most 5 bullets', ok: list.length <= 5, detail: `${list.length}` },
    { name: 'bullets <= 20 words', ok: longBullets.length === 0, detail: longBullets.map(b => `${words(b) - 1}w`).join(', ') },
    { name: `<= ${MAX_WORDS + 10} words without code`, ok: words(prose) <= MAX_WORDS + 10, detail: `${words(prose)}w` },
    { name: 'keeps key terms', ok: lost.length === 0, detail: lost.join(', ') },
  ]
}

async function main() {
  const only = process.argv[2]
  const jobs: (() => Promise<Result>)[] = []

  if (!only || only === 'boost') {
    for (const c of boostCases) {
      jobs.push(async () => {
        const { output, seconds } = await runClaude(BOOST_MODEL, systemFor('clean'), buildPrompt(c.input, []))
        return { suite: `boost (${BOOST_MODEL})`, id: c.id, input: c.input, output, seconds, checks: boostChecks(c.input, output, c.mustKeep) }
      })
    }
  }

  if (!only || only === 'tldr') {
    for (const c of replyCases) {
      jobs.push(async () => {
        const { output, seconds } = await runClaude(SUMMARY_MODEL, TLDR_SYSTEM, tldrPrompt(c.question, c.reply))
        return { suite: `tldr (${SUMMARY_MODEL})`, id: c.id, input: c.question, output, seconds, checks: tldrChecks(output, c.mustKeep) }
      })
    }
  }

  const results = await pool(jobs, async job => {
    try {
      return await job()
    } catch (error) {
      return { suite: 'error', id: String(error), input: '', output: '', seconds: 0, checks: [{ name: 'ran', ok: false, detail: String(error) }] }
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(join(OUT_DIR, `${stamp}.json`), JSON.stringify(results, null, 2))

  const lines: string[] = [`# Eval ${stamp}`, '']
  for (const suite of [...new Set(results.map(r => r.suite))]) {
    const rows = results.filter(r => r.suite === suite)
    const passed = rows.filter(r => r.checks.every(c => c.ok)).length
    lines.push(`## ${suite}: ${passed}/${rows.length} pass all checks`, '')
    for (const r of rows) {
      const failed = r.checks.filter(c => !c.ok)
      lines.push(`### ${r.id} ${failed.length === 0 ? 'PASS' : 'FAIL'} (${r.seconds.toFixed(1)}s)`)
      for (const f of failed) lines.push(`- FAIL ${f.name}${f.detail ? `: ${f.detail}` : ''}`)
      lines.push('', `Input: ${r.input}`, '', '```text', r.output, '```', '')
    }
  }
  const report = join(OUT_DIR, `${stamp}.md`)
  writeFileSync(report, lines.join('\n'))

  for (const suite of [...new Set(results.map(r => r.suite))]) {
    const rows = results.filter(r => r.suite === suite)
    console.log(`${suite}: ${rows.filter(r => r.checks.every(c => c.ok)).length}/${rows.length}`)
  }
  console.log(report)
}

void main()
