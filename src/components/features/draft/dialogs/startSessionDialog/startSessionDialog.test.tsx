// Tests for the start-session dialog's "Include Backlog References in full" choice.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StartSessionDialog } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import { codeFolderBackend, codeFolderStateFixture } from '@test/mocks/codeFolderBackend'
import { render } from '@test/utils/testUtils'

const intent = { kind: 'focused' as const, sectionId: 's1', heading: 'Scope' }

describe('StartSessionDialog', () => {
  it('starts with the Backlog References listed unless "include in full" is ticked', async () => {
    const onStart = vi.fn()
    const { user } = render(
      <StartSessionDialog
        intent={intent}
        onClose={vi.fn()}
        onStart={onStart}
        pending={false}
        backlog={{ count: 1, changed: 0 }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    await user.click(screen.getByRole('checkbox', { name: /Include Backlog References in full/ }))
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    expect(onStart.mock.calls).toEqual([
      ['', false, true],
      ['', true, true],
    ])
  })

  it('says changed Copies come in full anyway', () => {
    render(
      <StartSessionDialog
        intent={intent}
        onClose={vi.fn()}
        onStart={vi.fn()}
        pending={false}
        backlog={{ count: 2, changed: 1 }}
      />,
    )
    expect(screen.getByText(/changed Backlog Copy is included in full anyway/)).toBeInTheDocument()
  })

  it('offers no choice for a Draft without Backlog References', () => {
    render(
      <StartSessionDialog
        intent={intent}
        onClose={vi.fn()}
        onStart={vi.fn()}
        pending={false}
        backlog={{ count: 0, changed: 0 }}
      />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('StartSessionDialog — Code Folders', () => {
  it('shows what code the session reads, reads it by default, and starts without it when switched off', async () => {
    codeFolderBackend('fleet', [codeFolderStateFixture({ branch: 'spike', onDefaultBranch: false })])
    const onStart = vi.fn()
    const { user } = render(
      <StartSessionDialog projectId="fleet" intent={intent} onClose={vi.fn()} onStart={onStart} pending={false} />,
    )
    const block = await screen.findByRole('group', { name: 'Code this session reads' })
    expect(block).toHaveTextContent('default is main')
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    await user.click(screen.getByRole('button', { name: 'Don’t read' }))
    await user.click(screen.getByRole('button', { name: 'Start grilling' }))
    expect(onStart.mock.calls).toEqual([
      ['', false, true],
      ['', false, false],
    ])
  })
})
