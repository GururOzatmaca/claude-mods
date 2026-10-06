export type Group = { code: string; size: number }

export type Segment =
  | { kind: 'prose'; text: string }
  | { kind: 'code'; raw: string; code: string; language: string; index: number; group?: Group }

const OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/
const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'shellscript'])
const MAX_GAP_LINES = 2

export const isShell = (language: string) => SHELL.has(language.toLowerCase())

export function splitFences(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []
  let prose: string[] = []
  let index = 0
  let i = 0

  const flushProse = () => {
    if (prose.join('').trim() !== '') segments.push({ kind: 'prose', text: prose.join('\n') })
    prose = []
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const open = OPEN.exec(line)
    if (open === null) {
      prose.push(line)
      i += 1
      continue
    }
    const fence = open[1] ?? '```'
    const close = new RegExp(`^ {0,3}${fence.startsWith('`') ? '`' : '~'}{${fence.length},}\\s*$`)
    let end = i + 1
    while (end < lines.length && !close.test(lines[end] ?? '')) end += 1
    if (end >= lines.length) {
      prose.push(...lines.slice(i))
      break
    }
    flushProse()
    index += 1
    segments.push({
      kind: 'code',
      raw: lines.slice(i, end + 1).join('\n'),
      code: lines.slice(i + 1, end).join('\n'),
      language: open[2] ?? '',
      index,
    })
    i = end + 1
  }
  flushProse()

  return groupShell(segments)
}

function groupShell(segments: Segment[]): Segment[] {
  const runs: Extract<Segment, { kind: 'code' }>[][] = []
  let run: Extract<Segment, { kind: 'code' }>[] = []

  for (const s of segments) {
    if (s.kind === 'code' && isShell(s.language)) {
      run.push(s)
    } else if (s.kind === 'code' || s.text.trim().split('\n').length > MAX_GAP_LINES) {
      runs.push(run)
      run = []
    }
  }
  runs.push(run)

  for (const r of runs) {
    const first = r[0]
    if (first !== undefined && r.length > 1) {
      first.group = { code: r.map(b => b.code).join('\n'), size: r.length }
    }
  }

  return segments
}

export function codeBlocks(text: string) {
  return splitFences(text).filter(s => s.kind === 'code')
}
