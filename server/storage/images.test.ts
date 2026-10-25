// Tests for Image storage: saving and reading back, unsafe ids, and removing a session's Images. Data in data-test/.
import fs from 'node:fs/promises'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { NotFound } from './errors.ts'
import { deleteSessionImages, readImage, saveImage } from './images.ts'
import { projectDir } from './paths.ts'
import { createProject } from './projects.ts'

beforeEach(resetTestData)

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const projectIn = async () => (await createProject('Portal', 'azure-devops', meta.date)).id
const pngAt = (projectId: string, sessionId: string, number: number) => ({
  projectId,
  sessionId,
  number,
  mediaType: 'image/png' as const,
})

describe('Image storage', () => {
  it('keeps an Image under the Project as images/<sessionId>/<number>.<ext> and reads back the same bytes', async () => {
    const projectId = await projectIn()
    await saveImage({ ...pngAt(projectId, 'sess-1', 1), data: PNG_BYTES.toString('base64') })
    await saveImage({ projectId, sessionId: 'sess-1', number: 2, mediaType: 'image/jpeg', data: 'AAAA' })

    const onDisk = await fs.readFile(path.join(projectDir(projectId), 'images', 'sess-1', '1.png'))
    expect(onDisk.equals(PNG_BYTES)).toBe(true)
    expect((await readImage(pngAt(projectId, 'sess-1', 1))).equals(PNG_BYTES)).toBe(true)
    await expect(fs.stat(path.join(projectDir(projectId), 'images', 'sess-1', '2.jpg'))).resolves.toBeTruthy()
  })

  it('refuses ids that are not a single safe path segment', async () => {
    const projectId = await projectIn()
    await expect(saveImage({ ...pngAt(projectId, '../escape', 1), data: 'AAAA' })).rejects.toThrow(NotFound)
    await expect(saveImage({ ...pngAt('../other', 'sess-1', 1), data: 'AAAA' })).rejects.toThrow(NotFound)
    await expect(readImage(pngAt(projectId, 'a/b', 1))).rejects.toThrow(NotFound)
    await expect(deleteSessionImages(projectId, '..')).rejects.toThrow(NotFound)
  })

  it('refuses a number that is not a positive whole number', async () => {
    const projectId = await projectIn()
    for (const number of [0, -1, 1.5, Number.NaN])
      await expect(saveImage({ ...pngAt(projectId, 'sess-1', number), data: 'AAAA' })).rejects.toThrow(NotFound)
  })

  it('does not find an Image that was never saved, or one saved under another Project', async () => {
    const projectId = await projectIn()
    const otherId = await projectIn()
    await saveImage({ ...pngAt(projectId, 'sess-1', 1), data: 'AAAA' })
    await expect(readImage(pngAt(projectId, 'sess-1', 2))).rejects.toThrow(NotFound)
    await expect(readImage(pngAt(otherId, 'sess-1', 1))).rejects.toThrow(NotFound)
  })

  it('deletes all of one session’s Images and leaves the others', async () => {
    const projectId = await projectIn()
    await saveImage({ ...pngAt(projectId, 'sess-1', 1), data: 'AAAA' })
    await saveImage({ ...pngAt(projectId, 'sess-1', 2), data: 'AAAA' })
    await saveImage({ ...pngAt(projectId, 'sess-2', 1), data: 'AAAA' })

    await deleteSessionImages(projectId, 'sess-1')
    await expect(readImage(pngAt(projectId, 'sess-1', 1))).rejects.toThrow(NotFound)
    await expect(readImage(pngAt(projectId, 'sess-1', 2))).rejects.toThrow(NotFound)
    await expect(readImage(pngAt(projectId, 'sess-2', 1))).resolves.toBeInstanceOf(Buffer)
    // Deleting what is not there is not an error.
    await expect(deleteSessionImages(projectId, 'sess-1')).resolves.toBeUndefined()
  })
})
