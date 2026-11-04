// Tests for the session-start block "Code this session reads": hidden without Code Folders, each folder's branch
// state with off-default, uncommitted and missing ones marked, the Read / Don't read switch, and the one-line form.
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SessionCodeChoice } from '@/components/features/codeFolders/sessionCodeChoice/sessionCodeChoice'
import { codeFolderBackend, codeFolderStateFixture } from '@test/mocks/codeFolderBackend'
import { render } from '@test/utils/testUtils'

const PROJECT = 'fleet'
const ui = codeFolderStateFixture({
  id: 'cf-ui',
  label: 'ui-lib',
  defaultBranch: 'develop',
  branch: 'feature/badge-variants',
  commit: '7be0d13',
  uncommitted: 3,
  onDefaultBranch: false,
})
const gone = codeFolderStateFixture({ id: 'cf-reports', label: 'reports', missing: true, branch: null, commit: '' })

describe('SessionCodeChoice', () => {
  it('shows nothing when the Project has no Code Folders', async () => {
    codeFolderBackend(PROJECT)
    render(<SessionCodeChoice projectId={PROJECT} read onChange={vi.fn()} compact />)
    // Give the state request time to answer, then make sure neither form of the block appeared.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.queryByText(/Reads/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Code this session reads' })).not.toBeInTheDocument()
  })

  it('lists each folder’s branch and commit, marking what may not be true yet and what is skipped', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture(), ui, gone])
    render(<SessionCodeChoice projectId={PROJECT} read onChange={vi.fn()} />)
    const block = await screen.findByRole('group', { name: 'Code this session reads' })
    const row = (label: string) => within(block).getByText(label).closest('tr')!
    expect(within(row('app')).getByText('main')).toBeInTheDocument()
    expect(within(row('app')).getByText('a41c9e2')).toBeInTheDocument()
    expect(within(row('app')).getByText('on default, clean')).toBeInTheDocument()
    expect(within(row('ui-lib')).getByText('default is develop · 3 uncommitted')).toBeInTheDocument()
    expect(within(row('reports')).getByText('missing, skipped')).toBeInTheDocument()
    expect(within(block).getByText(/may not be true yet/)).toBeInTheDocument()
  })

  it('reads by default, and switches to Don’t read', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    const onChange = vi.fn()
    const { user } = render(<SessionCodeChoice projectId={PROJECT} read onChange={onChange} />)
    expect(await screen.findByRole('button', { name: 'Read' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Don’t read' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('collapses to one line in the message box, and expands to change it', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture(), ui])
    const { user } = render(<SessionCodeChoice projectId={PROJECT} read onChange={vi.fn()} compact />)
    expect(await screen.findByText('Reads app@main, ui-lib@feature/badge-variants*')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Code this session reads' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'change' }))
    expect(screen.getByRole('group', { name: 'Code this session reads' })).toBeInTheDocument()
  })

  it('says so in one line when the session will read no code', async () => {
    codeFolderBackend(PROJECT, [codeFolderStateFixture()])
    render(<SessionCodeChoice projectId={PROJECT} read={false} onChange={vi.fn()} compact />)
    expect(await screen.findByText('Reads no code')).toBeInTheDocument()
  })
})
