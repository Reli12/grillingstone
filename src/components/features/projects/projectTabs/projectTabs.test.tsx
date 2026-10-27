// Tests for ProjectTabs: the Drafts, Glossary and Prototypes tabs, each linking to its own URL.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import type { ProjectTab } from '@/types/projectPage'
import { render } from '@test/utils/testUtils'

const selectedTabs = (selected: ProjectTab) => {
  render(<ProjectTabs projectId="portal" selected={selected} />)
  return screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')
}

describe('ProjectTabs', () => {
  it('links each tab to its URL and marks the Drafts tab selected', () => {
    render(<ProjectTabs projectId="portal" selected="drafts" />)
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('href', '/p/portal')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('href', '/p/portal/glossary')
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('href', '/p/portal/prototypes')
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Prototypes' })).toHaveAttribute('aria-selected', 'false')
  })

  it('marks the Glossary tab selected', () => {
    expect(selectedTabs('glossary').map((tab) => tab.textContent)).toEqual(['Glossary'])
  })

  it('marks the Prototypes tab selected', () => {
    expect(selectedTabs('prototypes').map((tab) => tab.textContent)).toEqual(['Prototypes'])
  })
})
