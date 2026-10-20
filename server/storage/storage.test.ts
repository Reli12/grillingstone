// Tests for the file store: safe Project ids, serialised Draft updates, Glossary versioning, Settings cleanup, old Transcripts.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { PROJECT_APP_ENTRIES } from '#core/shared/projectFolder.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, getDraft, updateDraft } from './drafts.ts'
import { StaleWrite, UnsafeFile } from './errors.ts'
import { writeJson } from './fsUtil.ts'
import { getGlossary, saveGlossary } from './glossary.ts'
import { glossaryFile, projectDir, safeId, settingsFile, templateTranscriptFile, transcriptFile } from './paths.ts'
import { createProject } from './projects.ts'
import { getSettings, saveSettings } from './settings.ts'
import { getTemplateTranscript, getTranscript, listTemplateTranscripts, listTranscripts } from './transcripts.ts'

beforeEach(resetTestData)

/** Where macOS and Linux both keep mkfifo, called by full path rather than through PATH. */
const MKFIFO = '/usr/bin/mkfifo'

const draftIn = async () => {
  const project = await createProject('Ünïcode & Co!', meta.date)
  return createDraft(
    newDraft({
      projectId: project.id,
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'x',
      now: meta.date,
    }),
  )
}

describe('storage', () => {
  it('slugs Project names into safe ids', async () => {
    expect((await createProject('Ünïcode & Co!', meta.date)).id).toMatch(/^unicode-co-[a-z0-9]{5}$/)
    expect((await createProject('!!!', meta.date)).id).toMatch(/^project-/)
    expect(() => safeId('../etc')).toThrow('Invalid id')
  })

  it('keeps nothing in a Project folder but its Glossary and the entries Codex on Linux is kept from writing', async () => {
    const draft = await draftIn()
    await saveGlossary(draft.projectId, '# Glossary\n', (await getGlossary(draft.projectId)).version)
    const entries = await fs.readdir(projectDir(draft.projectId))
    expect(entries.toSorted()).toEqual(['CONTEXT.md', ...PROJECT_APP_ENTRIES].toSorted())
  })

  it('never reads the Glossary through a link a session put in its place', async () => {
    const draft = await draftIn()
    const secret = path.join(projectDir(draft.projectId), '..', 'secret.txt')
    await fs.writeFile(secret, 'token')
    await fs.symlink(secret, glossaryFile(draft.projectId))
    await expect(getGlossary(draft.projectId)).rejects.toThrow(UnsafeFile)
  })

  it('never blocks on a Glossary a session turned into a named pipe', async () => {
    const draft = await draftIn()
    execFileSync(MKFIFO, [glossaryFile(draft.projectId)])
    await expect(getGlossary(draft.projectId)).rejects.toThrow(UnsafeFile)
  })

  it('serialises Draft updates and skips writes that change nothing', async () => {
    const draft = await draftIn()
    const bump = () =>
      updateDraft(draft.projectId, draft.id, (current) => ({ ...current, references: [...current.references, 'r'] }))
    await Promise.all([bump(), bump(), bump()])
    expect((await getDraft(draft.projectId, draft.id)).references).toEqual(['r', 'r', 'r'])
    const unchanged = await updateDraft(draft.projectId, draft.id, () => null)
    expect(unchanged.updatedAt).toBe((await getDraft(draft.projectId, draft.id)).updatedAt)
  })

  it('refuses a Glossary save made against an older version', async () => {
    const { projectId } = await draftIn()
    const v0 = await getGlossary(projectId)
    await saveGlossary(projectId, 'mine', v0.version)
    await expect(saveGlossary(projectId, 'theirs', v0.version)).rejects.toThrow(StaleWrite)
    expect((await getGlossary(projectId)).markdown).toBe('mine')
  })

  it('cleans Settings on save', async () => {
    const junk = {
      author: ' ',
      assistant: 'gpt' as never,
      models: { claude: ' ', codex: ' o4 ' },
      theme: 'neon' as never,
    }
    expect(await saveSettings(junk)).toMatchObject({
      assistant: 'claude',
      models: { claude: '', codex: 'o4' },
      theme: 'system',
    })
    expect((await getSettings()).author).toBeTruthy()
  })

  it('reads Settings saved before the Assistant choice as Claude, with the old model as Claude’s', async () => {
    await writeJson(settingsFile, { author: 'dorijan', model: ' opus ', theme: 'dark' })
    expect(await getSettings()).toEqual({
      author: 'dorijan',
      assistant: 'claude',
      models: { claude: 'opus', codex: '' },
      theme: 'dark',
    })
  })
})

describe('Transcripts saved before the Assistant seam', () => {
  /** A Transcript as it was stored before it named its Assistant: Claude Code's id in `claudeSessionId`. */
  const legacy = (projectId: string) => ({
    id: 'sess-old',
    projectId,
    draftId: 'd1',
    kind: 'first',
    status: 'stopped',
    writeConfirmed: false,
    startedAt: meta.date,
    claudeSessionId: 'claude-old',
    messages: [],
  })

  it('read as held by Claude, with the old id as the conversation to resume', async () => {
    const project = await createProject('Legacy', meta.date)
    await writeJson(transcriptFile(project.id, 'sess-old'), legacy(project.id))
    const expected = { assistant: 'claude', conversationId: 'claude-old' }
    expect(await getTranscript(project.id, 'sess-old')).toMatchObject(expected)
    expect(await listTranscripts(project.id)).toEqual([expect.objectContaining(expected)])
    expect(await getTranscript(project.id, 'sess-old')).not.toHaveProperty('claudeSessionId')
  })

  it('read a Template Session without an Assistant as held by Claude', async () => {
    const { projectId: _projectId, draftId: _draftId, ...template } = legacy('')
    await writeJson(templateTranscriptFile('tsess-old'), { ...template, id: 'tsess-old', kind: 'template' })
    expect(await getTemplateTranscript('tsess-old')).toMatchObject({ assistant: 'claude' })
    expect(await listTemplateTranscripts()).toEqual([expect.objectContaining({ assistant: 'claude' })])
  })
})
