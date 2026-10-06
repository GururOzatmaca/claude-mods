import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { isPrompt } from '../jump-list/hooks/entries'
import { parseTranscript } from '../jump-list/hooks/transcript'

const dir = process.argv[2] ?? ''
const newest = readdirSync(dir)
  .filter(f => f.endsWith('.jsonl'))
  .map(f => ({ f, mtime: statSync(join(dir, f)).mtimeMs, size: statSync(join(dir, f)).size }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 2)

for (const { f, size } of newest) {
  const text = readFileSync(join(dir, f), 'utf8')
  const lines = text.split('\n').filter(Boolean)
  const types = new Map<string, number>()
  const userShapes = new Map<string, number>()
  for (const l of lines) {
    try {
      const row = JSON.parse(l)
      types.set(row.type, (types.get(row.type) ?? 0) + 1)
      if (row.type === 'user') {
        const c = row.message?.content
        const shape = `${typeof c === 'string' ? 'string' : Array.isArray(c) ? `array[${c.map((b: { type: string }) => b.type).join(',')}]` : typeof c} meta=${row.isMeta === true} side=${row.isSidechain === true} uuid=${row.uuid !== undefined}`
        userShapes.set(shape, (userShapes.get(shape) ?? 0) + 1)
      }
    } catch {
      types.set('bad-json', (types.get('bad-json') ?? 0) + 1)
    }
  }
  const rows = parseTranscript(text, isPrompt)
  console.log(`${f} ${(size / 1048576).toFixed(2)} MB lines=${lines.length} prompts=${rows.prompts.length}`)
  console.log('  types:', JSON.stringify([...types]))
  console.log('  user shapes:', JSON.stringify([...userShapes].slice(0, 8)))
}
