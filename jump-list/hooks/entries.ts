export type Mark = 'edit' | 'fail'

export type Entry = { text: string; uuid?: string; rowId?: string; at?: number; marks: Set<Mark>; isVisible: boolean | undefined }

export function clockTime(at: number | undefined): string {
  if (at === undefined) return '--:--'
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MARK_GLYPH: Record<Mark, string> = { edit: '✎', fail: '✗' }

const PASTE_TAG = /<\/?pasted_content(?:\s[^>]*)?>/g

export function unwrap(text: string): string {
  return text.replace(PASTE_TAG, '')
}

export function preview(text: string): string {
  return unwrap(text).replace(/\s+/g, ' ').trim()
}

export function isPrompt(text: string): boolean {
  const clean = unwrap(text).trim()
  return clean !== '' && !clean.startsWith('/') && !clean.startsWith('<') && !clean.startsWith('[Request interrupted')
}

export function label(entry: Entry, width: number): string {
  const marks = [...entry.marks].map(m => MARK_GLYPH[m]).join('')
  const time = entry.at === undefined ? '' : clockTime(entry.at)
  const head = [time, marks].filter(part => part !== '').join(' ') + (time === '' && marks === '' ? '' : ' ')
  const room = Math.max(4, width - head.length)
  const body = preview(entry.text)
  return head + (body.length > room ? `${body.slice(0, room - 1)}…` : body)
}

export function addPrompt(entries: Entry[], text: string, uuid?: string, at?: number): boolean {
  if (!isPrompt(text)) return false
  entries.push({ text, uuid, at, marks: new Set(), isVisible: undefined })
  return true
}

export function attachUuid(entries: Entry[], text: string, uuid: string): boolean {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i]
    if (entry !== undefined && entry.uuid === undefined && preview(entry.text) === preview(text)) {
      entry.uuid = uuid
      return true
    }
  }
  return false
}

export type RowResult = 'matched' | 'visibility' | 'unchanged' | 'unknown' | 'volatile'

export function seeRow(entries: Entry[], id: string, text: string, isVisible: boolean | undefined): RowResult {
  const owner = entries.find(e => e.rowId === id)
  if (owner !== undefined) {
    if (preview(owner.text) !== preview(text)) {
      owner.rowId = undefined
      owner.isVisible = undefined
      return 'volatile'
    }
    if (owner.isVisible === isVisible) return 'unchanged'
    owner.isVisible = isVisible
    return 'visibility'
  }
  const byUuid = entries.find(e => e.uuid === id && e.rowId === undefined)
  const candidates = byUuid !== undefined ? [byUuid] : [...entries].reverse()
  for (const entry of candidates) {
    if (entry.rowId === undefined && preview(entry.text) === preview(text)) {
      entry.rowId = id
      entry.isVisible = isVisible
      return 'matched'
    }
  }
  return 'unknown'
}

export function jumpTarget(entry: Entry): string | undefined {
  return entry.rowId ?? entry.uuid
}

export function mark(entries: Entry[], kind: Mark): boolean {
  const last = entries.at(-1)
  if (last === undefined || last.marks.has(kind)) return false
  last.marks.add(kind)
  return true
}
