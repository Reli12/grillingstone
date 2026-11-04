// Code Folder routes: check a folder before linking it, link, edit and unlink Code Folders, their current branch
// state (for the Code Folders tab and wherever a session starts) and the exclusion preview.
import { parse } from '../http/body.ts'
import type { Router } from '../http/router.ts'
import { codeFolderCheckBody, codeFolderUpdateBody, newCodeFolderBody } from '../http/schemas.ts'
import type { AppDeps } from './deps.ts'

export function codeFolderRoutes(router: Router, { codeFolders }: AppDeps) {
  const base = '/api/projects/:projectId/code-folders'
  router.post(`${base}/check`, ({ params, body }) =>
    codeFolders.check(params.projectId, parse(codeFolderCheckBody, body).path),
  )
  router.get(`${base}/state`, ({ params }) => codeFolders.states(params.projectId))
  router.post(base, ({ params, body }) => codeFolders.add(params.projectId, parse(newCodeFolderBody, body)))
  router.patch(`${base}/:folderId`, ({ params, body }) =>
    codeFolders.update(params.projectId, params.folderId, parse(codeFolderUpdateBody, body)),
  )
  router.delete(`${base}/:folderId`, ({ params }) => codeFolders.remove(params.projectId, params.folderId))
  router.get(`${base}/:folderId/exclusions`, ({ params }) => codeFolders.preview(params.projectId, params.folderId))
}
