// Tests for the file store: safe Project ids, serialised Draft updates, Glossary versioning, Settings cleanup, old Transcripts.
import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, getDraft, updateDraft } from './drafts.ts'
import { StaleWrite } from './errors.ts'
import { writeJson } from './fsUtil.ts'
import { getGlossary, saveGlossary } from './glossary.ts'
import { safeId, templateTranscriptFile, transcriptFile } from './paths.ts'
import { createProject } from './projects.ts'
import { getSettings, saveSettings } from './settings.ts'
import { getTemplateTranscript, getTranscript, listTemplateTranscripts, listTranscripts } from './transcripts.ts'

beforeEach(resetTestData)

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
    expect(await saveSettings({ author: ' ', model: ' ', theme: 'neon' as never })).toMatchObject({
      model: '',
      theme: 'system',
    })
    expect((await getSettings()).author).toBeTruthy()
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
