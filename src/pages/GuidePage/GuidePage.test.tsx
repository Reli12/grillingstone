// Tests for GuidePage: the walkthrough's steps and its inert live examples.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import GuidePage from '@/pages/GuidePage/GuidePage'
import { render } from '@test/utils/testUtils'

describe('GuidePage', () => {
  it('walks through the steps with live examples that go nowhere', async () => {
    const { user } = render(<GuidePage />)
    expect(screen.getByRole('heading', { name: 'Create a Project' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Steps' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Recommended/ })[0])
    expect(await screen.findByText('Example only — in a real session this goes to Claude.')).toBeInTheDocument()
  })

  it('explains the name in its own section at the top', () => {
    render(<GuidePage />)
    const nameSection = screen.getByRole('region', { name: 'Why “Whetstone”?' })
    const firstStep = screen.getByRole('heading', { name: 'Create a Project' })
    expect(nameSection.compareDocumentPosition(firstStep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
