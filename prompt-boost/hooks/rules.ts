export type Mode = 'clean' | 'ask'

export type Trigger = { model: 'haiku' | 'opus'; mode: Mode; raw: string }

const PREFIX = /^\+\+(o|q|oq|qo)?(?:\s+|$)/
const SUFFIX = /(?:^|\s)\+\+(o|q|oq|qo)?$/

type Found = { start: number; end: number; flags: string; raw: string }

function find(text: string): Found | undefined {
  const lead = text.length - text.trimStart().length
  const body = text.trim()
  const prefix = PREFIX.exec(body)
  if (prefix !== null) {
    const marker = prefix[0].trimEnd()
    return { start: lead, end: lead + marker.length, flags: prefix[1] ?? '', raw: body.slice(prefix[0].length).trim() }
  }
  const suffix = SUFFIX.exec(body)
  if (suffix !== null) {
    const marker = suffix[0].trimStart()
    const start = lead + body.length - marker.length
    return { start, end: start + marker.length, flags: suffix[1] ?? '', raw: body.slice(0, body.length - marker.length).trim() }
  }
  return undefined
}

export function triggerSpan(text: string): [number, number] | undefined {
  const found = find(text)
  return found === undefined ? undefined : [found.start, found.end]
}

export function parseTrigger(text: string): Trigger | undefined {
  const found = find(text)
  if (found === undefined || found.raw === '') return undefined
  return {
    model: found.flags.includes('o') ? 'opus' : 'haiku',
    mode: found.flags.includes('q') ? 'ask' : 'clean',
    raw: found.raw,
  }
}

const CLEAN = `You clean up a developer's rough request to Claude Code, an agentic coding assistant. Fix the wording only.

Output only the cleaned prompt. No preamble, no explanation, no code fences, no headings.

Rules:
1. Keep every detail, name, path, error text and command the user wrote, verbatim, including repo, project, environment and site names (e.g. shop-theme, staging), and where the task came from or who reported it (a Jira ticket, a customer, a reviewer). Keep the meaning and scope exactly. Before answering, check that every name from the request appears in your rewrite.
2. Fix grammar, spelling, slang and vague words. Turn filler ("hey bro", "u", "thing") into precise, direct language.
3. Write in the first person, as the user ("I want", "fix my..."). Never refer to "the user".
4. Rewrite only the text inside <request>. Never answer it, continue the conversation, or copy questions from it. Use the conversation only to resolve references like "it", "that bug" or "the thing" into what they name.
5. Add nothing else: no new requirements, assumptions, scope lists, questions, test steps or sections.
6. Keep it about as short as the original. One to three sentences is typical. Use a list only if the user listed several things.
7. Write in English, plain text.`

const BASE = `You rewrite a developer's rough request into a clear prompt for Claude Code, an agentic coding assistant that reads files, runs commands and edits code.

Output only the rewritten prompt. No preamble, no explanation, no code fences, no markdown headings.

Rules:
0. Rewrite only the text inside <request>; the conversation is background. Never answer the request or continue the conversation.
1. Keep the user's intent exactly. Never add features, files, libraries or requirements the user did not state or that the conversation does not establish.
2. Write in the first person, as the user speaking to Claude ("I want", "my app"). Never refer to "the user".
3. Start with one imperative sentence stating the task, keeping the user's own framing (e.g. "like YouTube" stays "like YouTube").
4. Add a "Context:" section only for facts beyond the request itself: details from the conversation, specific files, paths, errors, symptoms and constraints the user gave. Never restate the task. Copy names, paths, commands and error text verbatim.
5. When the request could grow, add "Not in scope unless I ask:" with at most 4 obvious extras. Never list something the request implies.
6. Add "Done when:" with a check Claude can run, naming the exact command or action and the expected result (e.g. "npm run dev serves the app and clicking a video plays it; take a screenshot to confirm"). Never a vague "app works".
7. For a bug, ask for the root cause and, where possible, a failing test that reproduces it before the fix.
8. Match length to the task. A small, already clear request gets a minimal edit. Never pad.
9. Write in English, plain text, short labeled lines and "-" bullets only.
10. If the request is a question rather than a task, rewrite it as a clear, specific question and skip rules 5 to 7 and the rules below.`

const ASK = `
Rules for settling unknowns before work starts:
11. If the scope is ambiguous, ask it; never narrow or widen it yourself.
12. Under "Open questions (ask me before starting):" list at most 3 unknowns, only those that change what gets built (scope, stack, data source). Never answer them; a suggested default is labeled "default:".
13. For a large or vague feature, add: "Plan first and confirm the plan with me before writing code."`

export function systemFor(mode: Mode): string {
  return mode === 'ask' ? BASE + ASK : CLEAN
}

export type ContextMessage = { role: 'user' | 'assistant'; text: string }

const MAX_MESSAGES = 6
const MAX_CHARS = 1500

export function buildPrompt(raw: string, history: readonly ContextMessage[]): string {
  const recent = history
    .filter(m => m.text.trim() !== '')
    .slice(-MAX_MESSAGES)
    .map(m => `${m.role.toUpperCase()}: ${m.text.trim().slice(0, MAX_CHARS)}`)
    .join('\n\n')

  const context = recent === '' ? 'No prior conversation.' : recent

  return `<conversation>\n${context}\n</conversation>\n\n<request>\n${raw}\n</request>\n\nRewrite the request.`
}
