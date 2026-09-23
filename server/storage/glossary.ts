// The Project Glossary is CONTEXT.md in the Project folder, versioned by content hash so a save made
// against an older version is refused (ADR-0003).
import { createHash } from 'node:crypto'
import type { GlossaryDoc } from '#core/contract/apiTypes.ts'
import { StaleWrite } from './errors.ts'
import { KeyedLock, readText, writeFileAtomic } from './fsUtil.ts'
import { glossaryFile } from './paths.ts'
import { getProject } from './projects.ts'

const lock = new KeyedLock()
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)

export async function getGlossary(projectId: string): Promise<GlossaryDoc> {
  await getProject(projectId)
  const markdown = (await readText(glossaryFile(projectId))) ?? ''
  return { markdown, version: hash(markdown) }
}

/** The Glossary a new Project starts from, written before anyone else can have it open. */
export const startGlossary = (projectId: string, markdown: string) => writeFileAtomic(glossaryFile(projectId), markdown)

/** Refuses a save made against an older version (another session or tab changed it meanwhile). */
export function saveGlossary(projectId: string, markdown: string, baseVersion: string): Promise<GlossaryDoc> {
  return lock.run(projectId, async () => {
    const current = await getGlossary(projectId)
    if (current.version !== baseVersion) throw new StaleWrite('The Glossary changed since you opened it — reloaded the latest version.')
    await writeFileAtomic(glossaryFile(projectId), markdown)
    return { markdown, version: hash(markdown) }
  })
}
