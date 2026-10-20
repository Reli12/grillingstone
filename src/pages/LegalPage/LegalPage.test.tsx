// Tests for LegalPage: the license, how the tool uses each Assistant, and the terms that apply to the human.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import LegalPage from '@/pages/LegalPage/LegalPage'
import { render } from '@test/utils/testUtils'

describe('LegalPage', () => {
  it('links each Anthropic rule that applies to you to its published page, in a new tab', () => {
    render(<LegalPage />)
    const publishedPages = {
      'Consumer Terms of Service': 'https://www.anthropic.com/legal/consumer-terms',
      'Commercial Terms of Service': 'https://www.anthropic.com/legal/commercial-terms',
      'Usage Policy': 'https://www.anthropic.com/legal/aup',
      'Privacy Policy': 'https://www.anthropic.com/legal/privacy',
      'Claude Code legal and compliance': 'https://code.claude.com/docs/en/legal-and-compliance',
    }
    for (const [name, href] of Object.entries(publishedPages)) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('links each OpenAI rule that applies to you to its published page, in a new tab', () => {
    render(<LegalPage />)
    const publishedPages = {
      'Terms of Use': 'https://openai.com/policies/terms-of-use/',
      'Services Agreement': 'https://openai.com/policies/services-agreement/',
      'Usage Policies': 'https://openai.com/policies/usage-policies/',
      'OpenAI Privacy Policy': 'https://openai.com/policies/privacy-policy/',
      'Sign in with ChatGPT developer docs': 'https://developers.openai.com/siwc/token-sharing-open-source',
    }
    for (const [name, href] of Object.entries(publishedPages)) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('dates its comparison with each provider’s terms separately', () => {
    render(<LegalPage />)
    const intro = screen.getByText(/Last compared with Anthropic’s published terms/)
    expect(intro).toHaveTextContent('Anthropic’s published terms on 15 October 2026')
    expect(intro).toHaveTextContent('OpenAI’s Sign in with ChatGPT developer docs on 20 October 2026')
    expect(intro).toHaveTextContent('OpenAI’s Terms of Use have not been compared yet')
  })

  it('says how it meets OpenAI’s rule for local, open-source apps that use your ChatGPT sign-in', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'How Grilling Stone uses Codex' })
    expect(section).toHaveTextContent('your own installed, unmodified Codex')
    expect(section).toHaveTextContent('never sees, stores or passes on your credentials')
    expect(section).toHaveTextContent('open-source and locally hosted apps')
    expect(section).toHaveTextContent('a paid or remotely hosted service needs OpenAI’s permission')
  })

  it('says how it meets Anthropic’s conditions for tools that run Claude Code', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'How Grilling Stone uses Claude Code' })
    expect(section).toHaveTextContent('your own installed, unmodified Claude Code')
    expect(section).toHaveTextContent('never sees, stores or passes on your credentials')
    expect(section).toHaveTextContent('a Claude subscription or an Anthropic API key')
    expect(section).toHaveTextContent('doesn’t pay for, resell or route Claude usage')
  })

  it('makes you responsible for what you share with your Assistant, which the author never receives', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'Your data and your responsibility' })
    expect(section).toHaveTextContent('Grilling Stone itself sends nothing anywhere')
    expect(section).toHaveTextContent('Claude Code sends them to Anthropic, and Codex to OpenAI')
    expect(section).toHaveTextContent('You are responsible for what you share with your Assistant')
    expect(section).toHaveTextContent('never receives, sees or stores your data')
  })

  it('licenses its own code under MIT and claims no tie to Anthropic, OpenAI or Microsoft', () => {
    render(<LegalPage />)
    expect(screen.getByRole('region', { name: 'License' })).toHaveTextContent('MIT License')
    expect(screen.getByRole('region', { name: 'Trademarks' })).toHaveTextContent(
      'not affiliated with, endorsed by or sponsored by Anthropic, OpenAI or Microsoft',
    )
  })
})
