export const MIN_LINES = 15
export const TLDR_MODEL = 'sonnet'
export const MAX_WORDS = 100

const MAX_QUESTION_CHARS = 1500

export const TLDR_SYSTEM = `You summarize one reply from Claude Code, a coding assistant, for a developer who reads English as a second language.

You get the developer's question in <question> (it may be empty) and Claude's reply in <reply>. Summarize only the reply.

Output only the summary in markdown. No preamble, no explanation of what you did.

Hard limits:
1. At most ${MAX_WORDS} words in total, not counting code blocks. Count them. This limit beats every other wish to include more.
2. No headings, no title line. Start with 1 to 3 plain sentences that answer the question: the core idea, as if explaining to a beginner. Cover the main concept even when the reply spends more space on details.
3. Then at most 5 bullets. Each bullet is one line of at most 15 words and holds one point.
4. Keep a code block only if the developer must run or copy it, and put it after the bullets.
5. Output this one summary and stop. Never add a second version or sections from the original.

What to keep, in this order of priority. When the word limit forces a cut, drop examples, background and nice-to-know details first:
- every step the developer must do, and every open point Claude left (e.g. a permission still to add),
- every status: done, not done, not deployed, not tested, failed,
- every warning or risk, and each option's verdict exactly as given (recommended, works but risky, do not use),
- every condition that limits a statement (only when, after, if, unless, a pushed branch, removed rather than stopped, inside a transaction),
- exact names of errors (e.g. ERESOLVE), environments (e.g. staging), changed files, commands and numbers.

Never add facts, advice or steps that are not in the reply. Never change who did something (Claude did the work, not the developer).
Use simple A2-level English. Keep technical terms and explain them in a few plain words; never replace a term with a vaguer word.`

export function isLong(text: string): boolean {
  return text.split('\n').length >= MIN_LINES
}

export type ConversationMessage = { role: 'user' | 'assistant'; text: string }

export function questionFor(messages: readonly ConversationMessage[], reply: string): string {
  const probe = reply.trim().slice(0, 200)
  let at = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m !== undefined && m.role === 'assistant' && m.text.includes(probe)) {
      at = i
      break
    }
  }
  for (let i = at - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m !== undefined && m.role === 'user' && m.text.trim() !== '') return m.text.trim().slice(0, MAX_QUESTION_CHARS)
  }
  return ''
}

export function tldrPrompt(question: string, reply: string): string {
  return `<question>\n${question}\n</question>\n\n<reply>\n${reply}\n</reply>`
}
