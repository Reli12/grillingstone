// A stateful fake of one Project's Code Folder endpoints: check (refusing or warning by path, like the real linking
// rules), link (refusing a taken label with 422 reasons), edit, unlink, current state and the exclusion preview.
import { http, HttpResponse } from 'msw'

import type {
  CodeFolder,
  CodeFolderCheck,
  CodeFolderState,
  ExclusionPreview,
} from '#core/codeFolder/codeFolderTypes.ts'
import type { Project } from '#core/contract/apiTypes.ts'

import type { CodeFolderChange, NewCodeFolder } from '@/api/codeFoldersApi'
import { endpoints } from '@/api/endpoints/endpoints'
import { server } from '@test/mocks/server'

export interface CodeFolderBackend {
  states: CodeFolderState[]
  added: NewCodeFolder[]
  updated: { folderId: string; change: CodeFolderChange }[]
  removed: string[]
  checked: string[]
}

export const codeFolderStateFixture = (patch: Partial<CodeFolderState> = {}): CodeFolderState => ({
  id: 'cf-app',
  label: 'app',
  path: 'C:\\work\\contoso\\fleet-portal',
  defaultBranch: 'main',
  extraExclusions: [],
  missing: false,
  inGit: true,
  branch: 'main',
  commit: 'a41c9e2',
  uncommitted: 0,
  onDefaultBranch: true,
  ...patch,
})

export const exclusionPreviewFixture: ExclusionPreview = {
  readable: 1284,
  groups: [
    {
      rule: 'environment',
      label: 'Environment files',
      fixed: true,
      count: 2,
      examples: ['.env', 'apps/web/.env.local'],
    },
    { rule: 'ignored', label: 'Ignored by git', fixed: false, count: 3, examples: ['node_modules/', 'dist/', '.env'] },
  ],
  stillReadable: ['.env.example'],
}

/** What the fake check says about a path: C:\ is refused, a path with "nogit" is warned about, anything else is fine. */
function checkOf(path: string): CodeFolderCheck {
  const base = {
    path,
    suggestedLabel: path.split(/[\\/]/).pop()!.toLowerCase(),
    suggestedDefaultBranch: 'main',
    inGit: true,
  }
  if (/^[a-z]:\\?$/i.test(path))
    return {
      ...base,
      check: {
        status: 'rejected',
        reasons: [{ code: 'drive-root', message: 'It is a drive root — linking it would expose the whole drive.' }],
      },
    }
  if (path.includes('nogit'))
    return {
      ...base,
      suggestedDefaultBranch: '',
      inGit: false,
      check: {
        status: 'ok-with-warnings',
        warnings: [
          { code: 'not-in-git', message: 'It is not inside a git checkout — sessions get no branch information.' },
        ],
      },
    }
  return { ...base, check: { status: 'ok' } }
}

export function codeFolderBackend(projectId: string, states: CodeFolderState[] = []): CodeFolderBackend {
  const backend: CodeFolderBackend = { states, added: [], updated: [], removed: [], checked: [] }
  const project = (): Project => ({
    id: projectId,
    name: 'Fleet',
    createdAt: '',
    tracker: 'azure-devops',
    codeFolders: backend.states.map(({ id, label, path, defaultBranch, extraExclusions }): CodeFolder => ({
      id,
      label,
      path,
      defaultBranch,
      extraExclusions,
    })),
  })
  server.use(
    http.get(`*${endpoints.codeFolderState(projectId)}`, () => HttpResponse.json(backend.states)),
    http.post(`*${endpoints.codeFolderCheck(projectId)}`, async ({ request }) => {
      const { path } = (await request.json()) as { path: string }
      backend.checked.push(path)
      return HttpResponse.json(checkOf(path))
    }),
    http.post(`*${endpoints.codeFolders(projectId)}`, async ({ request }) => {
      const folder = (await request.json()) as NewCodeFolder
      if (backend.states.some((state) => state.label === folder.label))
        return HttpResponse.json(
          {
            error: 'taken',
            reasons: [
              {
                code: 'label-taken',
                message: `Another Code Folder in this Project is already labelled "${folder.label}".`,
              },
            ],
          },
          { status: 422 },
        )
      backend.added.push(folder)
      backend.states = [...backend.states, codeFolderStateFixture({ ...folder, id: `cf-${folder.label}` })]
      return HttpResponse.json(project())
    }),
    http.patch(`*${endpoints.codeFolders(projectId)}/:folderId`, async ({ request, params }) => {
      const change = (await request.json()) as CodeFolderChange
      const folderId = String(params.folderId)
      backend.updated.push({ folderId, change })
      backend.states = backend.states.map((state) => (state.id === folderId ? { ...state, ...change } : state))
      return HttpResponse.json(project())
    }),
    http.delete(`*${endpoints.codeFolders(projectId)}/:folderId`, ({ params }) => {
      backend.removed.push(String(params.folderId))
      backend.states = backend.states.filter((state) => state.id !== params.folderId)
      return HttpResponse.json(project())
    }),
    http.get(`*${endpoints.codeFolders(projectId)}/:folderId/exclusions`, () =>
      HttpResponse.json(exclusionPreviewFixture),
    ),
  )
  return backend
}
