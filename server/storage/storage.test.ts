// Tests for the file store: safe Project ids, serialised Draft updates, Glossary versioning, Settings cleanup,
// and each Project's Tracker.
import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, getDraft, updateDraft } from './drafts.ts'
import { Conflict, NotFound, StaleWrite } from './errors.ts'
import { writeJson } from './fsUtil.ts'
import { getGlossary, saveGlossary } from './glossary.ts'
import { projectFile, safeId } from './paths.ts'
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.ts'
import { getSettings, saveSettings } from './settings.ts'

beforeEach(resetTestData)

const draftIn = async () => {
  const project = await createProject('Ünïcode & Co!', 'azure-devops', meta.date)
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
    expect((await createProject('Ünïcode & Co!', 'azure-devops', meta.date)).id).toMatch(/^unicode-co-[a-z0-9]{5}$/)
    expect((await createProject('!!!', 'azure-devops', meta.date)).id).toMatch(/^project-/)
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
    const dirty = { author: ' ', model: ' ', theme: 'neon' as never, defaultTracker: 'linear' as never }
    expect(await saveSettings(dirty)).toMatchObject({ model: '', theme: 'system', defaultTracker: 'azure-devops' })
    expect((await getSettings()).author).toBeTruthy()
  })

  it('deletes a Project with its Drafts and Glossary, leaving the other Projects', async () => {
    const draft = await draftIn()
    const { projectId } = draft
    const other = await createProject('Other', 'jira', meta.date)
    await deleteProject(projectId)
    await expect(getProject(projectId)).rejects.toThrow(NotFound)
    await expect(getDraft(projectId, draft.id)).rejects.toThrow(NotFound)
    expect((await listProjects()).map((project) => project.id)).toEqual([other.id])
    await expect(deleteProject(projectId)).rejects.toThrow(NotFound)
  })

  describe("a Project's Tracker", () => {
    it('can change while the Project has no Draft', async () => {
      const project = await createProject('Portal', 'azure-devops', meta.date)
      expect((await updateProject(project.id, { tracker: 'jira' })).tracker).toBe('jira')
      expect((await getProject(project.id)).tracker).toBe('jira')
    })

    it('is fixed once the Project has a Draft, while a rename still works', async () => {
      const { projectId } = await draftIn()
      await expect(updateProject(projectId, { tracker: 'jira' })).rejects.toThrow(Conflict)
      await expect(updateProject(projectId, { tracker: 'azure-devops', name: 'Renamed' })).resolves.toMatchObject({
        name: 'Renamed',
        tracker: 'azure-devops',
      })
    })

    it('reads as Azure DevOps for a Project saved before Trackers existed', async () => {
      const project = await createProject('Old', 'jira', meta.date)
      await writeJson(projectFile(project.id), { id: project.id, name: 'Old', createdAt: meta.date })
      expect((await getProject(project.id)).tracker).toBe('azure-devops')
      expect((await listProjects()).find((summary) => summary.id === project.id)?.tracker).toBe('azure-devops')
    })

    it('reads Settings saved before Trackers existed with Azure DevOps as the Default Tracker', async () => {
      expect((await getSettings()).defaultTracker).toBe('azure-devops')
    })
  })
})
