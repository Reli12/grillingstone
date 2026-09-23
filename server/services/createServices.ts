import type { Hub } from '../hub.ts'
import type { AppDeps } from '../routes/deps.ts'
import { Supervisor } from '../sessions/supervisor.ts'
import { DraftService } from './draftService.ts'
import { GlossaryService } from './glossaryService.ts'
import { TemplateService } from './templateService.ts'

/** Wires the services and the Supervisor around one Hub. */
export function createServices(hub: Hub): AppDeps {
  const drafts = new DraftService(hub)
  const templates = new TemplateService(hub)
  const glossary = new GlossaryService(hub)
  const supervisor = new Supervisor({ hub, drafts, templates, glossary })
  return { supervisor, drafts, templates, glossary }
}
