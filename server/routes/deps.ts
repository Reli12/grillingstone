// The dependencies every route module receives from createServices.
import type { BacklogService } from '../ado/backlogService.ts'
import type { ConnectionService } from '../ado/connectionService.ts'
import type { ImportService } from '../ado/importService.ts'
import type { PublishService } from '../ado/publishService.ts'
import type { CodeFolderService } from '../codeFolders/codeFolderService.ts'
import type { BacklogCopyService } from '../services/backlogCopyService.ts'
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
  backlogCopies: BacklogCopyService
  codeFolders: CodeFolderService
  connection: ConnectionService
  backlog: BacklogService
  publish: PublishService
  imports: ImportService
}
