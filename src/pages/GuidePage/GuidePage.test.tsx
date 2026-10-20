// Tests for GuidePage: the walkthrough's steps and its inert live examples.
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import GuidePage from '@/pages/GuidePage/GuidePage'
import { settingsFixture } from '@test/mocks/handlers'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

describe('GuidePage', () => {
  it('walks through the steps with live examples that go nowhere', async () => {
    const { user } = render(<GuidePage />)
    expect(screen.getByRole('heading', { name: 'Create a Project' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Steps' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Recommended/ })[0])
    expect(await screen.findByText('Example only — in a real session this goes to Claude.')).toBeInTheDocument()
  })

  it('starts by choosing the Assistant, with how to set up each one', () => {
    render(<GuidePage />)
    const step = screen.getByRole('region', { name: 'Choose your Assistant' })
    expect(screen.getAllByRole('heading', { level: 2 }).at(1)).toHaveTextContent('Choose your Assistant')
    expect(step).toHaveTextContent('claude auth login')
    expect(step).toHaveTextContent('codex login')
    expect(within(step).getByRole('link', { name: 'Choose it in Settings' })).toHaveAttribute('href', '/settings')
  })

  it('names the Assistant chosen in Settings throughout', async () => {
    server.use(http.get(`*${endpoints.settings}`, () => HttpResponse.json({ ...settingsFixture, assistant: 'codex' })))
    const { user } = render(<GuidePage />)
    expect(await screen.findByText(/Codex interrogates it one question at a time/)).toBeInTheDocument()
    expect(screen.queryByText(/Claude interrogates/)).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('ask Codex to rework any part')
    expect(screen.getByRole('region', { name: 'Make it your team’s' })).toHaveTextContent(
      'the writing method Codex follows',
    )
    await user.click(screen.getAllByRole('button', { name: /Recommended/ })[0])
    expect(await screen.findByText('Example only — in a real session this goes to Codex.')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveTextContent('Codex runs as Codex CLI, on your ChatGPT plan')
  })

  it('explains the name in its own section at the top', () => {
    render(<GuidePage />)
    const nameSection = screen.getByRole('region', { name: 'Why “Grilling Stone”?' })
    const firstStep = screen.getByRole('heading', { name: 'Create a Project' })
    expect(nameSection.compareDocumentPosition(firstStep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('closes with either way to sign in to the chosen Assistant and a link to the Legal page', () => {
    render(<GuidePage />)
    expect(screen.getByRole('complementary')).toHaveTextContent('your Claude subscription or Anthropic API key')
    expect(screen.getByRole('link', { name: 'Legal' })).toHaveAttribute('href', '/legal')
  })
})
