// Tests for ProjectTabs: Drafts, Backlog Copies (Azure DevOps Projects only) and Glossary, each at its own URL.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import { render } from '@test/utils/testUtils'

describe('ProjectTabs', () => {
  it('links each tab to its URL and marks the Drafts tab selected', () => {
    render(<ProjectTabs projectId="portal" selected="drafts" showBacklog />)
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('href', '/p/portal')
    expect(screen.getByRole('tab', { name: 'Backlog Copies' })).toHaveAttribute('href', '/p/portal/backlog')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('href', '/p/portal/glossary')
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'false')
  })

  it('marks the Glossary or Backlog Copies tab selected', () => {
    const { unmount } = render(<ProjectTabs projectId="portal" selected="glossary" showBacklog />)
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    render(<ProjectTabs projectId="portal" selected="backlog" showBacklog />)
    expect(screen.getByRole('tab', { name: 'Backlog Copies' })).toHaveAttribute('aria-selected', 'true')
  })

  it('has no Backlog Copies tab in a Jira Project', () => {
    render(<ProjectTabs projectId="portal" selected="drafts" showBacklog={false} />)
    expect(screen.queryByRole('tab', { name: 'Backlog Copies' })).not.toBeInTheDocument()
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
