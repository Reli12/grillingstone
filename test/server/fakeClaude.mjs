#!/usr/bin/env node
// A stand-in for `claude -p` in server and browser (e2e/) tests: reads stream-json user messages on stdin and answers like a
// session would. It asks one question card; on "Write it now." it runs the real submit script with a valid
// payload for its kind of session (v1 Draft, Proposal or Template). A message containing CRASH makes it die.
// A turn with Images (a content array) is answered with one extra line, "Received image blocks: Image 1 (image/png, …)".
// In a Prototype Session (GRILLINGSTONE_GUARD_MODE=prototype) it takes one turn: reads draft.md, writes prototype.html
// in its working folder and submits it (see prototypeTurn).
// Like Claude Code it names its session in an init event; with --resume it keeps the name it is given.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { methodSkeleton } from '#core/template/templateValidator.ts'
import { validPbiContent } from '#core/testing/fixtures.ts'

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
const say = (text) => emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const done = () => emit({ type: 'result', is_error: false })
let seed = ''
const resumeAt = process.argv.indexOf('--resume')
const claudeSessionId = resumeAt >= 0 ? process.argv[resumeAt + 1] : `claude-${process.pid}`

function payload() {
  if (process.env.GRILLINGSTONE_GUARD_MODE === 'template')
    return {
      name: 'Spike PBI',
      method: methodSkeleton('Spike PBI'),
      sections: [
        {
          key: 'goal',
          heading: 'Goal',
          shape: 'prose',
          locked: true,
          guidance: 'What to find out',
          target: 'System.Description',
        },
      ],
    }
  const current = /## Current Draft[^\n]*\n```json\n([\s\S]*?)\n```/.exec(seed)
  if (!current) return validPbiContent()
  const prose = JSON.parse(current[1]).sections.find((s) => typeof s.body === 'string' && !s.entries)
  return {
    changes: [
      {
        kind: 'replaceSection',
        sectionId: prose.id,
        body: `${prose.body} (revised)`,
        label: `${prose.heading} · revise`,
      },
    ],
  }
}

const IMAGE_LABEL = /^Image (\d+):$/

/** A turn's content is plain text, or (when it carries Images) an array of text and image blocks. */
function readContent(content) {
  if (typeof content === 'string') return { text: content, images: [] }
  const text = content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  const images = []
  let label = ''
  for (const block of content) {
    if (block.type === 'text') label = IMAGE_LABEL.test(block.text) ? block.text.slice(0, -1) : ''
    if (block.type === 'image') {
      const { media_type: mediaType, data } = block.source
      images.push(`${label || 'Image ?'} (${mediaType}, ${data.length} base64 characters)`)
    }
  }
  return { text, images }
}

/** Announces a tool call and its result, the way Claude Code's stream shows them. */
function toolCall(id, name, input, result) {
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } })
  const block = { type: 'tool_result', tool_use_id: id, content: result.content }
  emit({ type: 'user', message: { content: [{ ...block, ...(result.isError ? { is_error: true } : {}) }] } })
}

/** Runs the real submit script with a payload on stdin, as the submit Bash command would. */
function submit(id, body) {
  const script = process.env.GRILLINGSTONE_SUBMIT_SCRIPT
  const command = `node "${script}" <<'GRILLINGSTONE_JSON'\n…\nGRILLINGSTONE_JSON`
  const run = spawnSync(process.execPath, [script], {
    input: JSON.stringify(body),
    env: process.env,
    encoding: 'utf8',
  })
  toolCall(id, 'Bash', { command }, { content: run.stdout, isError: run.status !== 0 })
  return run
}

// Markers in a Prototype Session's draft.md steer the fake: the first submit is refused, or the turn never ends
// (fake:hang), or it crashes (fake:crash), or it ends the turn without submitting (fake:no-submit).
const REFUSE_FIRST_MARKER = 'fake:refuse-first'
const HANG_MARKER = 'fake:hang'
// …or it dies after reading the Draft, or ends its turn without writing or submitting anything.
const CRASH_MARKER = 'fake:crash'
const NO_SUBMIT_MARKER = 'fake:no-submit'
const STARTING_ASSUMPTIONS_FILE = 'start-assumptions.md'
const PROTOTYPE_ASSUMPTIONS = [{ choice: 'Sample devices are invented', why: 'The Draft names no example data.' }]

const prototypePage = (withImage, extra) =>
  `<!doctype html><html><head><title>Prototype</title></head><body><main id="top"><h1>Prototype</h1>${withImage ? '<img src="images/1" alt="Reference">' : ''}<button id="go" onclick="document.getElementById('out').textContent = 'Done'">Go</button><p id="out"></p>${extra}</main></body></html>`

/**
 * A Prototype Session's single turn: read the Draft, write prototype.html in the working folder, submit it; when
 * the Draft carries the refuse marker the first page has an external link, which the Edit then removes.
 */
function prototypeTurn(images) {
  if (images.length) say(`Received image blocks: ${images.join('; ')}.`)
  const draftPath = path.join(process.cwd(), 'draft.md')
  const draft = fs.readFileSync(draftPath, 'utf8')
  toolCall('read-1', 'Read', { file_path: draftPath }, { content: 'ok' })
  if (draft.includes(HANG_MARKER)) return // the turn never ends, so the session stays running
  if (draft.includes(CRASH_MARKER)) {
    process.stderr.write('fake claude crashed\n')
    process.exit(3)
  }
  if (draft.includes(NO_SUBMIT_MARKER)) {
    say('I am done.')
    done()
    return
  }
  const filePath = path.join(process.cwd(), 'prototype.html')
  const refuseFirst = draft.includes(REFUSE_FIRST_MARKER)
  const badLink = '<a href="https://example.com/elsewhere">elsewhere</a>'
  const body = { prototype: 'prototype.html', assumptions: PROTOTYPE_ASSUMPTIONS }

  // Starting from an earlier Prototype (start-assumptions.md is in the folder): keep the page it left in
  // prototype.html, as the seed asks, and only touch it up.
  if (fs.existsSync(path.join(process.cwd(), STARTING_ASSUMPTIONS_FILE))) {
    const touchUp = { file_path: filePath, old_string: 'Prototype', new_string: 'Prototype' }
    toolCall('edit-0', 'Edit', touchUp, { content: 'ok' })
  } else {
    fs.writeFileSync(filePath, prototypePage(images.length > 0, refuseFirst ? badLink : ''))
    toolCall('write-1', 'Write', { file_path: filePath, content: '…' }, { content: 'ok' })
  }
  let run = submit('submit-1', body)
  if (run.status !== 0 && refuseFirst) {
    fs.writeFileSync(filePath, prototypePage(images.length > 0, ''))
    toolCall('edit-1', 'Edit', { file_path: filePath, old_string: badLink, new_string: '' }, { content: 'ok' })
    run = submit('submit-2', body)
  }
  say(run.status === 0 ? 'Written.' : 'Refused.')
  done()
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  const { text, images } = readContent(JSON.parse(line).message.content)
  if (!seed) {
    seed = text
    emit({ type: 'system', subtype: 'init', session_id: claudeSessionId })
    if (resumeAt >= 0) say('Picking up where we left off.')
  }
  if (process.env.GRILLINGSTONE_GUARD_MODE === 'prototype') {
    prototypeTurn(images)
    continue
  }
  if (text.includes('CRASH')) {
    process.stderr.write('fake claude crashed\n')
    process.exit(3)
  }
  if (text !== 'Write it now.') {
    // Lets tests see what reached the child process: one line naming each image block it received.
    if (images.length) say(`Received image blocks: ${images.join('; ')}.`)
    emit({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: `${process.cwd()}/CONTEXT.md` } },
        ],
      },
    })
    emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'ok' }] } })
    say(
      'One question.\n```pbi-question\n{"question": "Who may archive?", "recommended": "Managers", "options": ["Admins"]}\n```',
    )
    done()
    continue
  }
  const run = submit('submit-1', payload())
  say(run.status === 0 ? 'Written.' : 'Refused.')
  done()
}
