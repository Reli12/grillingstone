// Tests for ProjectTabs: the Drafts and Glossary tabs, each linking to its own URL.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import { render } from '@test/utils/testUtils'

describe('ProjectTabs', () => {
  it('links each tab to its URL and marks the Drafts tab selected', () => {
    render(<ProjectTabs projectId="portal" glossarySelected={false} />)
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('href', '/p/portal')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('href', '/p/portal/glossary')
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'false')
  })

  it('marks the Glossary tab selected', () => {
    render(<ProjectTabs projectId="portal" glossarySelected />)
    expect(screen.getByRole('tab', { name: 'Glossary' })).toHaveAttribute('aria-selected', 'true')
  })
})
