export type TranscriptRows = { prompts: { uuid: string; text: string; at?: number }[]; lastAnswer?: string }

type Row = {
  type?: string
  uuid?: string
  timestamp?: string
  isMeta?: boolean
  isSidechain?: boolean
  message?: { role?: string; content?: unknown }
}

export function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b): b is { type: string; text: string } => typeof b === 'object' && b !== null && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n')
}

export function createParser(isPrompt: (text: string) => boolean) {
  const rows: TranscriptRows = { prompts: [] }
  let pending = ''

  const line = (raw: string) => {
    if (raw.trim() === '') return
    let row: Row
    try {
      row = JSON.parse(raw) as Row
    } catch {
      return
    }
    if (row.uuid === undefined || row.isSidechain === true || row.isMeta === true) return
    const text = textOf(row.message?.content)
    const at = row.timestamp === undefined ? Number.NaN : Date.parse(row.timestamp)
    if (row.type === 'user' && isPrompt(text)) rows.prompts.push({ uuid: row.uuid, text, at: Number.isNaN(at) ? undefined : at })
    if (row.type === 'assistant' && text.trim() !== '') rows.lastAnswer = row.uuid
  }

  return {
    push(chunk: string) {
      const parts = (pending + chunk).split('\n')
      pending = parts.pop() ?? ''
      for (const part of parts) line(part)
    },
    finish(): TranscriptRows {
      line(pending)
      pending = ''
      return rows
    },
  }
}

export function parseTranscript(jsonl: string, isPrompt: (text: string) => boolean): TranscriptRows {
  const parser = createParser(isPrompt)
  parser.push(jsonl)
  return parser.finish()
}

export function projectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}
