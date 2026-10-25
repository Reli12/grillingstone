// Tests for Prototype storage: atomic save and read back, lists newest first by Draft and by Project, Delete, Dismiss,
// the Draft deletion cascade and refused ids. Data in data-test/.
import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import type { Prototype, PrototypeSession } from '#core/prototype/prototypeRecords.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, deleteDraft } from './drafts.ts'
import { NotFound } from './errors.ts'
import { prototypeFile, prototypeSessionFile } from './paths.ts'
import { createProject } from './projects.ts'
import {
  deletePrototype,
  deletePrototypeSession,
  getPrototype,
  getPrototypeSession,
  listPrototypes,
  listPrototypeSessions,
  readExtraImages,
  readPrototypeHtml,
  readPrototypeSource,
  saveExtraImages,
  savePrototype,
  savePrototypeSession,
} from './prototypes.ts'

beforeEach(resetTestData)

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const prototypeOf = (projectId: string, draftId: string, id: string, writtenAt: string): Prototype => ({
  id,
  projectId,
  draftId,
  draftVersion: 1,
  writtenAt,
  images: [{ number: 1, mediaType: 'image/png', source: 'Added on the start form' }],
  assumptions: [{ choice: 'Ten rows per page', why: 'The Draft gives no page size.' }],
})

const sessionOf = (projectId: string, draftId: string, id: string, prototypeId?: string): PrototypeSession => ({
  id,
  kind: 'prototype',
  projectId,
  draftId,
  draftVersion: 1,
  status: prototypeId ? 'finished' : 'failed',
  writeConfirmed: true,
  startedAt: meta.date,
  inputs: { tickedImages: [], extraImages: [] },
  ...(prototypeId ? { prototypeId } : {}),
  messages: [],
})

const exists = (file: string) =>
  fs.stat(file).then(
    () => true,
    () => false,
  )

async function projectWithDraft() {
  const { id: projectId } = await createProject('Portal', 'azure-devops', meta.date)
  const draft = await createDraft(
    newDraft({ projectId, workItemType: 'PBI', template: defaultPbiTemplate, requirement: 'x', now: meta.date }),
  )
  return { projectId, draftId: draft.id }
}

const save = (prototype: Prototype) =>
  savePrototype(prototype, { html: `<html>${prototype.id}</html>`, source: `<source>${prototype.id}</source>` })

describe('saving a Prototype', () => {
  it('keeps the page, Claude’s source and the record together and reads them back', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const prototype = prototypeOf(projectId, draftId, 'proto-1', '2026-10-01T10:00:00.000Z')
    await save(prototype)

    expect(await getPrototype(projectId, 'proto-1')).toEqual(prototype)
    expect(await readPrototypeHtml(projectId, 'proto-1')).toBe('<html>proto-1</html>')
    expect(await readPrototypeSource(projectId, 'proto-1')).toBe('<source>proto-1</source>')
    for (const part of ['html', 'source.html', 'json'] as const)
      expect(await exists(prototypeFile(projectId, 'proto-1', part))).toBe(true)
  })

  it('leaves nothing behind when a file cannot be written', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const prototype = prototypeOf(projectId, draftId, 'proto-1', '2026-10-01T10:00:00.000Z')
    // A folder where the record should go makes the last write fail after the two pages were written.
    await fs.mkdir(prototypeFile(projectId, 'proto-1', 'json'), { recursive: true })

    await expect(save(prototype)).rejects.toThrow()
    expect(await exists(prototypeFile(projectId, 'proto-1', 'html'))).toBe(false)
    expect(await exists(prototypeFile(projectId, 'proto-1', 'source.html'))).toBe(false)
  })

  it('does not serve a page whose record was never written', async () => {
    const { projectId } = await projectWithDraft()
    await fs.mkdir(path.dirname(prototypeFile(projectId, 'proto-9', 'html')), { recursive: true })
    await fs.writeFile(prototypeFile(projectId, 'proto-9', 'html'), '<html>orphan</html>')
    await expect(readPrototypeHtml(projectId, 'proto-9')).rejects.toThrow(NotFound)
  })
})

describe('listing Prototypes', () => {
  it('lists newest first by Draft and by Project', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const other = await createDraft(
      newDraft({ projectId, workItemType: 'PBI', template: defaultPbiTemplate, requirement: 'y', now: meta.date }),
    )
    await save(prototypeOf(projectId, draftId, 'proto-old', '2026-10-01T10:00:00.000Z'))
    await save(prototypeOf(projectId, other.id, 'proto-mid', '2026-10-02T10:00:00.000Z'))
    await save(prototypeOf(projectId, draftId, 'proto-new', '2026-10-03T10:00:00.000Z'))

    expect((await listPrototypes(projectId)).map((prototype) => prototype.id)).toEqual([
      'proto-new',
      'proto-mid',
      'proto-old',
    ])
    expect((await listPrototypes(projectId, draftId)).map((prototype) => prototype.id)).toEqual([
      'proto-new',
      'proto-old',
    ])
  })

  it('has no Prototypes for a Project without any, and refuses a Project that does not exist', async () => {
    const { projectId } = await projectWithDraft()
    expect(await listPrototypes(projectId)).toEqual([])
    await expect(listPrototypes('no-such-project')).rejects.toThrow(NotFound)
  })

  it('does not find another Project’s Prototype', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const { id: otherId } = await createProject('Other', 'azure-devops', meta.date)
    await save(prototypeOf(projectId, draftId, 'proto-1', '2026-10-01T10:00:00.000Z'))
    await expect(getPrototype(otherId, 'proto-1')).rejects.toThrow(NotFound)
  })
})

describe('Delete', () => {
  it('removes the three files and leaves a Prototype started from it intact', async () => {
    const { projectId, draftId } = await projectWithDraft()
    await save(prototypeOf(projectId, draftId, 'proto-1', '2026-10-01T10:00:00.000Z'))
    await save({
      ...prototypeOf(projectId, draftId, 'proto-2', '2026-10-02T10:00:00.000Z'),
      startingPrototypeId: 'proto-1',
    })
    await savePrototypeSession(sessionOf(projectId, draftId, 'sess-1', 'proto-1'))

    await deletePrototype(projectId, 'proto-1')

    for (const part of ['html', 'source.html', 'json'] as const)
      expect(await exists(prototypeFile(projectId, 'proto-1', part))).toBe(false)
    await expect(getPrototype(projectId, 'proto-1')).rejects.toThrow(NotFound)
    expect(await getPrototype(projectId, 'proto-2')).toMatchObject({ startingPrototypeId: 'proto-1' })
    expect(await readPrototypeHtml(projectId, 'proto-2')).toBe('<html>proto-2</html>')
    // The finished session that wrote it has nothing left to show.
    expect(await listPrototypeSessions(projectId)).toEqual([])
  })

  it('refuses a Prototype that does not exist', async () => {
    const { projectId } = await projectWithDraft()
    await expect(deletePrototype(projectId, 'proto-missing')).rejects.toThrow(NotFound)
  })
})

describe('Prototype Session records', () => {
  it('saves, reads back and lists them by Draft', async () => {
    const { projectId, draftId } = await projectWithDraft()
    await savePrototypeSession(sessionOf(projectId, draftId, 'sess-1'))
    await savePrototypeSession(sessionOf(projectId, 'd-other', 'sess-2'))

    expect(await getPrototypeSession(projectId, 'sess-1')).toMatchObject({ id: 'sess-1', status: 'failed' })
    expect((await listPrototypeSessions(projectId)).map((session) => session.id).sort()).toEqual(['sess-1', 'sess-2'])
    expect((await listPrototypeSessions(projectId, draftId)).map((session) => session.id)).toEqual(['sess-1'])
    await expect(getPrototypeSession(projectId, 'sess-missing')).rejects.toThrow(NotFound)
  })

  it('keeps copies of the extra Images and reads them back', async () => {
    const { projectId } = await projectWithDraft()
    const refs = await saveExtraImages(projectId, 'sess-1', [
      { mediaType: 'image/png', data: PIXEL },
      { mediaType: 'image/jpeg', data: 'AAAA' },
    ])
    expect(refs).toEqual([
      { number: 1, mediaType: 'image/png' },
      { number: 2, mediaType: 'image/jpeg' },
    ])
    expect(await readExtraImages(projectId, 'sess-1', refs)).toEqual([
      { mediaType: 'image/png', data: PIXEL },
      { mediaType: 'image/jpeg', data: 'AAAA' },
    ])
  })

  it('Dismiss removes the record and its Image copies', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const refs = await saveExtraImages(projectId, 'sess-1', [{ mediaType: 'image/png', data: PIXEL }])
    await savePrototypeSession({
      ...sessionOf(projectId, draftId, 'sess-1'),
      inputs: { tickedImages: [], extraImages: refs },
    })

    await deletePrototypeSession(projectId, 'sess-1')

    expect(await exists(prototypeSessionFile(projectId, 'sess-1'))).toBe(false)
    await expect(readExtraImages(projectId, 'sess-1', refs)).rejects.toThrow(NotFound)
    // Dismissing again is harmless.
    await expect(deletePrototypeSession(projectId, 'sess-1')).resolves.toBeUndefined()
  })
})

describe('deleting a Draft', () => {
  it('removes its Prototypes, session records and Image copies, and leaves other Drafts’ alone', async () => {
    const { projectId, draftId } = await projectWithDraft()
    const other = await createDraft(
      newDraft({ projectId, workItemType: 'PBI', template: defaultPbiTemplate, requirement: 'y', now: meta.date }),
    )
    await save(prototypeOf(projectId, draftId, 'proto-doomed', '2026-10-01T10:00:00.000Z'))
    await save(prototypeOf(projectId, other.id, 'proto-kept', '2026-10-01T10:00:00.000Z'))
    const refs = await saveExtraImages(projectId, 'sess-doomed', [{ mediaType: 'image/png', data: PIXEL }])
    await savePrototypeSession({
      ...sessionOf(projectId, draftId, 'sess-doomed'),
      inputs: { tickedImages: [], extraImages: refs },
    })
    await savePrototypeSession(sessionOf(projectId, other.id, 'sess-kept'))

    await deleteDraft(projectId, draftId)

    expect((await listPrototypes(projectId)).map((prototype) => prototype.id)).toEqual(['proto-kept'])
    expect((await listPrototypeSessions(projectId)).map((session) => session.id)).toEqual(['sess-kept'])
    await expect(readExtraImages(projectId, 'sess-doomed', refs)).rejects.toThrow(NotFound)
  })
})

describe('ids', () => {
  it('refuses an id that is not a single safe path segment', async () => {
    const { projectId } = await projectWithDraft()
    for (const id of ['../x', 'a/b', '..', '', 'a.b']) {
      await expect(getPrototype(projectId, id)).rejects.toThrow(NotFound)
      await expect(readPrototypeHtml(projectId, id)).rejects.toThrow(NotFound)
      await expect(getPrototypeSession(projectId, id)).rejects.toThrow(NotFound)
      await expect(deletePrototype(projectId, id)).rejects.toThrow(NotFound)
    }
    await expect(save(prototypeOf(projectId, 'd', '../escape', meta.date))).rejects.toThrow(NotFound)
  })
})
