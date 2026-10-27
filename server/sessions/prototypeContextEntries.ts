// The Prototypes a Grilling Session was given, read from Prototype storage as the context module wants them. A
// Prototype that no longer exists is an entry of its own, so the session can say it was left out.
import type { ContextEntry } from '#core/prototype/prototypeContext.ts'

import { NotFound } from '../storage/errors.ts'
import { getPrototype, readPrototypeImages, readPrototypeSource } from '../storage/prototypes.ts'

async function entryOf(projectId: string, id: string): Promise<ContextEntry> {
  try {
    const [prototype, html, images] = await Promise.all([
      getPrototype(projectId, id),
      readPrototypeSource(projectId, id),
      readPrototypeImages(projectId, id),
    ])
    return {
      kind: 'prototype',
      id,
      writtenAt: prototype.writtenAt,
      ...(prototype.draft ? { draftVersion: prototype.draft.draftVersion } : {}),
      html,
      assumptions: prototype.assumptions,
      images,
    }
  } catch (error) {
    if (error instanceof NotFound) return { kind: 'deleted', id }
    throw error
  }
}

/** The given ids once each, in the order given. */
export async function prototypeContextEntries(projectId: string, ids: readonly string[]): Promise<ContextEntry[]> {
  return Promise.all([...new Set(ids)].map((id) => entryOf(projectId, id)))
}
