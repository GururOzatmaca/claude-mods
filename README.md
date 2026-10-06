# claude-mods

Three mods for [Claude Code](https://code.claude.com/docs/en/plugins/mods/overview) (v2.1.287+). Install only the ones you want.

| Mod | What it does |
|---|---|
| **prompt-boost** | Put `++` at the start or end of a rough prompt. It is rewritten into clear English and put back in the prompt box for you to review before sending. |
| **reply-tools** | A copy button above every code block, `copy all` for consecutive shell commands, and a one-click `tl;dr` for long replies. |
| **jump-list** | A side pane listing every prompt of the session with its time. Click one to jump back to it; `↓ end` jumps to the bottom. |

## Install

```bash
claude plugin marketplace add GururOzatmaca/claude-mods
claude plugin install prompt-boost@claude-mods
claude plugin install reply-tools@claude-mods
claude plugin install jump-list@claude-mods
```

Or from inside a session: `/plugin install prompt-boost --marketplace GururOzatmaca/claude-mods`.

Run `/reload-plugins` in a running session to load them.

## prompt-boost

| You type | Result |
|---|---|
| `++ price wrong when i pick gift wrap, fix pls` | Haiku fixes the wording only: `The price is wrong when I pick gift wrap. Fix it.` |
| `fix it ++` | Same, with the marker at the end |
| `++o ...` | Uses Opus instead of Haiku |
| `++q ...` / `++oq ...` | Structured rewrite with scope, a "Done when" check and up to 3 open questions |

- The rewrite never adds requirements and keeps every name, path, error and command verbatim.
- The `++` turns orange as you type. `Boosting prompt...` shows while it works.
- `/ap` shows the last original next to its rewrite; `/ap undo` puts the original back.
- One model call per boosted prompt. Normal prompts are untouched.

## reply-tools

- `⧉ copy N` above each code block copies only that block.
- `⧉ copy all N` on the first of several shell blocks copies them joined.
- `/cb N` copies block N of the last reply, `/cb all` every shell block, `/cb` lists them.
- `↓ tl;dr` under replies of 15+ lines: a Sonnet summary of at most 100 words that keeps every step, status, warning and condition. `↑ original` switches back. Display only; Claude's context is unchanged.
- Adds a short system prompt section asking Claude to put copyable text (commands, messages, config) in code blocks.

Toggles (`/plugin configure reply-tools@claude-mods`): `copy_buttons`, `copy_instruction`, `tldr_button`.

## jump-list

- Prompts are read from the session transcript in order, with their send time, also after a resume. Large transcripts are streamed.
- On-screen prompts are bright; `✎` marks a turn that edited files, `✗` a failed command.
- `–` collapses the pane into a one-line `› Jumps (N)` button above the prompt.
- `/jumps` opens it. Opens on start when the terminal is 144+ columns wide (`open_on_start`).

Limits:
- Clicking and jumping need Claude Code's fullscreen layout.
- A prompt far above the screen may need a second click to land exactly, because Claude Code only draws rows near the screen.
- Streaming large transcripts uses `cat` (Linux, macOS).

## What these mods can reach

Mods run inside Claude Code with your permissions. Run `claude plugin validate <folder>` to see each mod's hooks and calls.

| Mod | Reads | Model calls | Other |
|---|---|---|---|
| prompt-boost | your prompt, last 6 messages | Haiku or Opus, per `++` prompt | none |
| reply-tools | replies | Sonnet, per tl;dr click | clipboard |
| jump-list | the session transcript file | none | runs `cat` on the transcript |

## Development

```bash
claude plugin validate ./prompt-boost
claude plugin test ./prompt-boost
npx tsx evals/run.ts boost
npx tsx evals/run.ts tldr
```

`evals/` runs the rewrite and tl;dr prompts against real models on fixed cases and checks the outputs. Set `EVAL_MODEL` to try another model.

## License

MIT
