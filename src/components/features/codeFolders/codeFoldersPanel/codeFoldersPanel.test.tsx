// Tests for the Code Folders tab: the table with each folder's branch state, linking (refused, warned then linked
// anyway, label taken), editing, unlinking, and the exclusion preview.
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CodeFoldersPanel } from '@/components/features/codeFolders/codeFoldersPanel/codeFoldersPanel'
import { codeFolderBackend, codeFolderStateFixture } from '@test/mocks/codeFolderBackend'
import { render } from '@test/utils/testUtils'

const PROJECT = 'fleet'
const ui = codeFolderStateFixture({
  id: 'cf-ui',
  label: 'ui-lib',
  path: 'C:\\work\\design-system\\packages\\ui',
  defaultBranch: 'develop',
  branch: 'feature/badge-variants',
  commit: '7be0d13',
  uncommitted: 3,
  onDefaultBranch: false,
})
const gone = codeFolderStateFixture({
  id: 'cf-reports',
  label: 'reports',
  path: 'D:\\old\\reports',
  missing: true,
  branch: null,
  commit: '',
})

const rowOf = async (label: string) => (await screen.findByText(label, { selector: 'td' })).closest('tr')!

describe('CodeFoldersPanel', () => {
  it('lists each Code Folder with its path, branch and state', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture(), ui, gone])
    render(<CodeFoldersPanel projectId={PROJECT} />)
    const app = await rowOf('app')
    expect(within(app).getByText('C:\\work\\contoso\\fleet-portal')).toBeInTheDocument()
    expect(within(app).getByText('main')).toBeInTheDocument()
    expect(within(app).getByText('a41c9e2')).toBeInTheDocument()
    expect(within(app).getByText('Clean')).toBeInTheDocument()
    const lib = await rowOf('ui-lib')
    expect(within(lib).getByText('feature/badge-variants')).toBeInTheDocument()
    expect(within(lib).getByText('Not develop')).toBeInTheDocument()
    expect(within(lib).getByText('3 uncommitted')).toBeInTheDocument()
    expect(within(await rowOf('reports')).getByText('Missing — skipped')).toBeInTheDocument()
  })

  it('says what Code Folders are when the Project has none', async () => {
    codeFolderBackend(PROJECT)
    render(<CodeFoldersPanel projectId={PROJECT} />)
    expect(await screen.findByText('No Code Folders yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Link a Code Folder/ })).toBeInTheDocument()
  })

  it('links a folder: checks the path, prefills label and default branch, then links it', async () => {
    const backend = codeFolderBackend(PROJECT)
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Link a Code Folder/ }))
    await user.type(screen.getByLabelText('Folder path'), 'C:\\work\\fleet-mobile')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByLabelText('Label')).toHaveValue('fleet-mobile')
    expect(screen.getByLabelText('Default branch')).toHaveValue('main')
    await user.type(screen.getByLabelText(/Extra exclusions/), 'exports/**')
    await user.click(screen.getByRole('button', { name: 'Link Code Folder' }))
    await waitFor(() =>
      expect(backend.added).toEqual([
        {
          path: 'C:\\work\\fleet-mobile',
          label: 'fleet-mobile',
          defaultBranch: 'main',
          extraExclusions: ['exports/**'],
        },
      ]),
    )
    expect(await rowOf('fleet-mobile')).toBeInTheDocument()
  })

  it('shows why a folder is refused, and offers no way to link it', async () => {
    const backend = codeFolderBackend(PROJECT)
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Link a Code Folder/ }))
    await user.type(screen.getByLabelText('Folder path'), 'C:\\')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText(/drive root/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Label')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Link Code Folder' })).not.toBeInTheDocument()
    expect(backend.added).toEqual([])
  })

  it('shows warnings and links only after “Link anyway”', async () => {
    const backend = codeFolderBackend(PROJECT)
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Link a Code Folder/ }))
    await user.type(screen.getByLabelText('Folder path'), 'C:\\scratch\\nogit-tool')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText(/not inside a git checkout/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Label')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Link anyway' }))
    await user.click(await screen.findByRole('button', { name: 'Link Code Folder' }))
    await waitFor(() => expect(backend.added.map((folder) => folder.label)).toEqual(['nogit-tool']))
  })

  it('shows the backend’s reason when the label is taken', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(await screen.findByRole('button', { name: /Link a Code Folder/ }))
    await user.type(screen.getByLabelText('Folder path'), 'C:\\other\\app')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    await user.click(await screen.findByRole('button', { name: 'Link Code Folder' }))
    expect(await screen.findByText(/already labelled "app"/)).toBeInTheDocument()
  })

  it('edits a Code Folder’s label, default branch and extra exclusions', async () => {
    const backend = codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(within(await rowOf('app')).getByRole('button', { name: 'Edit app' }))
    const label = screen.getByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'portal')
    await user.type(screen.getByLabelText(/Extra exclusions/), 'fixtures/customers/**')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(backend.updated).toEqual([
        {
          folderId: 'cf-app',
          change: { label: 'portal', defaultBranch: 'main', extraExclusions: ['fixtures/customers/**'] },
        },
      ]),
    )
  })

  it('unlinks a Code Folder, saying the folder itself is untouched', async () => {
    const backend = codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    const unlink = within(await rowOf('app')).getByRole('button', { name: 'Unlink app' })
    expect(unlink).toHaveAttribute('title', expect.stringMatching(/folder itself is not touched/))
    await user.click(unlink)
    await waitFor(() => expect(backend.removed).toEqual(['cf-app']))
    expect(await screen.findByText('No Code Folders yet')).toBeInTheDocument()
  })

  it('previews what a Code Folder excludes', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    const { user } = render(<CodeFoldersPanel projectId={PROJECT} />)
    await user.click(within(await rowOf('app')).getByRole('button', { name: 'Show what app excludes' }))
    const preview = await screen.findByRole('region', { name: 'What app excludes' })
    expect(within(preview).getByText('Environment files')).toBeInTheDocument()
    expect(within(preview).getByText('.env · apps/web/.env.local')).toBeInTheDocument()
    expect(within(preview).getByText(/1,284 files readable/)).toBeInTheDocument()
    expect(within(preview).getByText('.env.example')).toBeInTheDocument()
  })
})
