// Tests for deleting a Draft: its Transcripts and their Images go with it, other Drafts' stay, and a Draft that is
// still there keeps its Transcripts. Data in data-test/.
import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import type { Transcript } from '#core/session/sessionTypes.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, deleteDraft, getDraft } from './drafts.ts'
import { NotFound } from './errors.ts'
import { readImage, saveImage } from './images.ts'
import { createProject } from './projects.ts'
import { getTranscript, listTranscripts, saveTranscript } from './transcripts.ts'

beforeEach(resetTestData)

/** A Draft with one ended session that has one Image saved. */
async function draftWithImage(projectId: string, sessionId: string) {
  const draft = await createDraft(
    newDraft({ projectId, workItemType: 'PBI', template: defaultPbiTemplate, requirement: 'x', now: meta.date }),
  )
  const transcript: Transcript = {
    id: sessionId,
    projectId,
    draftId: draft.id,
    kind: 'first',
    status: 'finished',
    writeConfirmed: true,
    startedAt: meta.date,
    lastImageNumber: 1,
    messages: [
      {
        id: 'm1',
        at: meta.date,
        role: 'human',
        kind: 'message',
        text: '',
        images: [{ number: 1, mediaType: 'image/png' }],
      },
    ],
  }
  await saveTranscript(transcript)
  await saveImage({ projectId, sessionId, number: 1, mediaType: 'image/png', data: 'AAAA' })
  return draft
}

const imageOf = (projectId: string, sessionId: string) => ({
  projectId,
  sessionId,
  number: 1,
  mediaType: 'image/png' as const,
})

describe('deleting a Draft', () => {
  it('removes its Transcripts and their Images and leaves other Drafts’ alone', async () => {
    const { id: projectId } = await createProject('Portal', 'azure-devops', meta.date)
    const doomed = await draftWithImage(projectId, 'sess-doomed')
    const kept = await draftWithImage(projectId, 'sess-kept')

    await deleteDraft(projectId, doomed.id)

    await expect(getDraft(projectId, doomed.id)).rejects.toThrow(NotFound)
    expect(await listTranscripts(projectId, doomed.id)).toEqual([])
    await expect(getTranscript(projectId, 'sess-doomed')).rejects.toThrow(NotFound)
    await expect(readImage(imageOf(projectId, 'sess-doomed'))).rejects.toThrow(NotFound)

    expect(await listTranscripts(projectId, kept.id)).toHaveLength(1)
    await expect(readImage(imageOf(projectId, 'sess-kept'))).resolves.toBeInstanceOf(Buffer)
  })

  it('removes Transcripts of a Draft that never had Images', async () => {
    const { id: projectId } = await createProject('Portal', 'azure-devops', meta.date)
    const draft = await draftWithImage(projectId, 'sess-1')
    await saveTranscript({ ...(await getTranscript(projectId, 'sess-1')), id: 'sess-2', messages: [] })
    await deleteDraft(projectId, draft.id)
    expect(await listTranscripts(projectId)).toEqual([])
  })
})
