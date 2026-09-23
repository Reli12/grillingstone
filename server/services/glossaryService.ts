import type { Hub } from '../hub.ts'
import { saveGlossary } from '../storage/glossary.ts'

export class GlossaryService {
  private hub: Hub

  constructor(hub: Hub) {
    this.hub = hub
  }

  async save(projectId: string, markdown: string, baseVersion: string) {
    const doc = await saveGlossary(projectId, markdown, baseVersion)
    this.hub.broadcast({ type: 'glossary', projectId })
    return doc
  }

  /** A session edited CONTEXT.md itself. */
  changedBySession = (projectId: string) => this.hub.broadcast({ type: 'glossary', projectId })
}
