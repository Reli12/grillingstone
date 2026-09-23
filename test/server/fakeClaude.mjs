#!/usr/bin/env node
// A stand-in for `claude -p` in server tests: reads stream-json user messages on stdin and answers like a
// session would. It asks one question card; on "Write it now." it runs the real submit script with a valid
// payload for its kind of session (v1 Draft, Proposal or Template). A message containing CRASH makes it die.
// Like Claude Code it names its session in an init event; with --resume it keeps the name it is given.
import { spawnSync } from 'node:child_process'
import readline from 'node:readline'
import { validPbiContent } from '#core/testing/fixtures.ts'
import { methodSkeleton } from '#core/template/templateValidator.ts'

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
const say = (text) => emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const done = () => emit({ type: 'result', is_error: false })
let seed = ''
const resumeAt = process.argv.indexOf('--resume')
const claudeSessionId = resumeAt >= 0 ? process.argv[resumeAt + 1] : `claude-${process.pid}`

function payload() {
  if (process.env.WHETSTONE_GUARD_MODE === 'template')
    return {
      name: 'Spike PBI',
      method: methodSkeleton('Spike PBI'),
      sections: [{ key: 'goal', heading: 'Goal', shape: 'prose', locked: true, guidance: 'What to find out', target: 'System.Description' }],
    }
  const current = /## Current Draft[^\n]*\n```json\n([\s\S]*?)\n```/.exec(seed)
  if (!current) return validPbiContent()
  const prose = JSON.parse(current[1]).sections.find((s) => typeof s.body === 'string' && !s.entries)
  return { changes: [{ kind: 'replaceSection', sectionId: prose.id, body: `${prose.body} (revised)`, label: `${prose.heading} · revise` }] }
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  const text = JSON.parse(line).message.content
  if (!seed) {
    seed = text
    emit({ type: 'system', subtype: 'init', session_id: claudeSessionId })
    if (resumeAt >= 0) say('Picking up where we left off.')
  }
  if (text.includes('CRASH')) {
    process.stderr.write('fake claude crashed\n')
    process.exit(3)
  }
  if (text !== 'Write it now.') {
    emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: `${process.cwd()}/CONTEXT.md` } }] } })
    emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'ok' }] } })
    say('One question.\n```pbi-question\n{"question": "Who may archive?", "recommended": "Managers", "options": ["Admins"]}\n```')
    done()
    continue
  }
  const script = process.env.WHETSTONE_SUBMIT_SCRIPT
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'submit-1', name: 'Bash', input: { command: `node "${script}" <<'WHETSTONE_JSON'\n…\nWHETSTONE_JSON` } }] } })
  const run = spawnSync(process.execPath, [script], { input: JSON.stringify(payload()), env: process.env, encoding: 'utf8' })
  emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'submit-1', content: run.stdout, is_error: run.status !== 0 }] } })
  say(run.status === 0 ? 'Written.' : 'Refused.')
  done()
}
