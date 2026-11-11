// Builds the backend's object graph once: each service announces its changes through the same Hub, and the
// Supervisor gets the services a session's submission writes through.
import type { FetchLike } from '../ado/adoClient.ts'
import { BacklogService } from '../ado/backlogService.ts'
import { ConnectionService } from '../ado/connectionService.ts'
import { ImportService } from '../ado/importService.ts'
import { PublishService } from '../ado/publishService.ts'
import type { SecretStore } from '../ado/secretStore.ts'
import { CodeFolderService } from '../codeFolders/codeFolderService.ts'
import type { Hub } from '../hub.ts'
import type { AppDeps } from '../routes/deps.ts'
import { Supervisor } from '../sessions/supervisor.ts'
import { BacklogCopyService } from './backlogCopyService.ts'
import { DraftService } from './draftService.ts'
import { GlossaryService } from './glossaryService.ts'
import { TemplateService } from './templateService.ts'

/** What tests replace: Azure DevOps at the HTTP boundary, and where the token is kept. */
export interface AdoOverrides {
  fetch?: FetchLike
  store?: SecretStore
}

/** Wires the services and the Supervisor around one Hub. */
export function createServices(hub: Hub, ado: AdoOverrides = {}): AppDeps {
  const drafts = new DraftService(hub)
  const templates = new TemplateService(hub)
  const glossary = new GlossaryService(hub)
  const backlogCopies = new BacklogCopyService(hub, drafts)
  const codeFolders = new CodeFolderService()
  const supervisor = new Supervisor({ hub, drafts, templates, glossary, codeFolders })
  const connection = new ConnectionService({ hub, ...ado })
  const backlog = new BacklogService(hub, connection)
  const publish = new PublishService(drafts, connection)
  const imports = new ImportService({ drafts, copies: backlogCopies, supervisor, connection })
  return { supervisor, drafts, templates, glossary, backlogCopies, codeFolders, connection, backlog, publish, imports }
}
