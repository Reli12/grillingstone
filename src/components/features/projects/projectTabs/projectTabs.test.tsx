// Tests for ProjectTabs: Drafts, Backlog Copies (Azure DevOps Projects only), Glossary, Code Folders and Prototypes,
// each at its own URL.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import type { ProjectTab } from '@/types/projectPage'
import { render } from '@test/utils/testUtils'

const selectedTabs = (selected: ProjectTab) => {
  render(<ProjectTabs projectId="portal" selected={selected} showBacklog />)
  return screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')
}

describe('ProjectTabs', () => {
  it('links each tab to its URL and marks the Drafts tab selected', () => {
    render(<ProjectTabs projectId="portal" selected="drafts" showBacklog />)
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('href', '/p/portal')
    expect(screen.getByRole('tab', { name: 'Backlog Copies' })).toHaveAttribute('href', '/p/portal/backlog')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('href', '/p/portal/glossary')
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('href', '/p/portal/prototypes')
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('aria-selected', 'false')
  })

  it('marks the Glossary tab selected', () => {
    expect(selectedTabs('glossary').map((tab) => tab.textContent)).toEqual(['Glossary'])
  })

  it('marks the Backlog Copies tab selected', () => {
    expect(selectedTabs('backlog').map((tab) => tab.textContent)).toEqual(['Backlog Copies'])
  })

  it('marks the Prototypes tab selected', () => {
    expect(selectedTabs('prototypes').map((tab) => tab.textContent)).toEqual(['Prototypes'])
  })

  it('has no Backlog Copies tab in a Jira Project', () => {
    render(<ProjectTabs projectId="portal" selected="drafts" showBacklog={false} />)
    expect(screen.queryByRole('tab', { name: 'Backlog Copies' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toBeInTheDocument()
  })
})

describe('ProjectTabs — Code Folders', () => {
  it('has a Code Folders tab at its own URL in either Tracker, selectable', () => {
    const { unmount } = render(<ProjectTabs projectId="portal" selected="code" showBacklog={false} />)
    expect(screen.getByRole('tab', { name: 'Code Folders' })).toHaveAttribute('href', '/p/portal/code')
    expect(screen.getByRole('tab', { name: 'Code Folders' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    render(<ProjectTabs projectId="portal" selected="drafts" showBacklog />)
    expect(screen.getByRole('tab', { name: 'Code Folders' })).toHaveAttribute('aria-selected', 'false')
  })
})
