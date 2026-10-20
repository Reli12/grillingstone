// The Project Glossary is CONTEXT.md in the Project folder, versioned by content hash so a save made
// against an older version is refused (ADR-0003).
import { createHash } from 'node:crypto'

import type { GlossaryDoc } from '#core/contract/apiTypes.ts'

import { StaleWrite } from './errors.ts'
import { KeyedLock, readSessionWritableText, writeFileAtomic } from './fsUtil.ts'
import { glossaryFile } from './paths.ts'
import { getProject } from './projects.ts'

/** A session may write the Glossary, so it could have swapped the file for a link; the backend never follows one. */
const UNSAFE_GLOSSARY =
  'This Project’s CONTEXT.md isn’t a plain file, so it isn’t read. Replace it with the Glossary’s text.'

const lock = new KeyedLock()
/** Enough hex characters of the SHA-256 to tell Glossary versions apart. */
const VERSION_HASH_LENGTH = 16
const hash = (markdown: string) => createHash('sha256').update(markdown).digest('hex').slice(0, VERSION_HASH_LENGTH)

export async function getGlossary(projectId: string): Promise<GlossaryDoc> {
  await getProject(projectId)
  const markdown = (await readSessionWritableText(glossaryFile(projectId), UNSAFE_GLOSSARY)) ?? ''
  return { markdown, version: hash(markdown) }
}

/** The Glossary a new Project starts from, written before anyone else can have it open. */
export const startGlossary = (projectId: string, markdown: string) => writeFileAtomic(glossaryFile(projectId), markdown)

/** Refuses a save made against an older version (another session or tab changed it meanwhile). */
export function saveGlossary(projectId: string, markdown: string, baseVersion: string): Promise<GlossaryDoc> {
  return lock.run(projectId, async () => {
    const current = await getGlossary(projectId)
    if (current.version !== baseVersion)
      throw new StaleWrite('The Glossary changed since you opened it — reloaded the latest version.')
    await writeFileAtomic(glossaryFile(projectId), markdown)
    return { markdown, version: hash(markdown) }
  })
}
