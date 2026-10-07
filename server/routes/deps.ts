// The dependencies every route module receives from createServices.
import type { DraftService } from '../services/draftService.ts'
import type { GlossaryService } from '../services/glossaryService.ts'
import type { TemplateService } from '../services/templateService.ts'
import type { Supervisor } from '../sessions/supervisor.ts'

/** What route handlers work with. Reads go straight to storage; changes go through a service. */
export interface AppDeps {
  supervisor: Supervisor
  drafts: DraftService
  templates: TemplateService
  glossary: GlossaryService
}
