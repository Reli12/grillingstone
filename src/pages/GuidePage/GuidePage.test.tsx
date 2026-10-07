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
})
