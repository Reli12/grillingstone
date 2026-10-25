// Tests for LegalPage: the license, how the tool uses Claude Code, and the terms that apply to the human.
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

  it('says how it meets Anthropic’s conditions for tools that run Claude Code', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'How Grilling Stone uses Claude Code' })
    expect(section).toHaveTextContent('your own installed, unmodified Claude Code')
    expect(section).toHaveTextContent('never sees, stores or passes on your credentials')
    expect(section).toHaveTextContent('a Claude subscription or an Anthropic API key')
    expect(section).toHaveTextContent('doesn’t pay for, resell or route Claude usage')
  })

  it('makes you responsible for what you share with Claude, which the author never receives', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'Your data and your responsibility' })
    expect(section).toHaveTextContent('Grilling Stone itself sends nothing anywhere')
    expect(section).toHaveTextContent('You are responsible for what you share with Claude')
    expect(section).toHaveTextContent('never receives, sees or stores your data')
  })

  it('lists Images among what is sent to Anthropic and what stays in data/, and warns to crop them', () => {
    render(<LegalPage />)
    const section = screen.getByRole('region', { name: 'Your data and your responsibility' })
    expect(section).toHaveTextContent('Transcripts, Images, Templates and settings stay in its data/ folder')
    expect(section).toHaveTextContent('What you type, the Images you add, the Draft')
    expect(section).toHaveTextContent('Screenshots often show more than you intend')
    expect(section).toHaveTextContent('customer data, tokens or other windows')
  })

  it('licenses its own code under MIT and claims no tie to Anthropic, Microsoft or Atlassian', () => {
    render(<LegalPage />)
    expect(screen.getByRole('region', { name: 'License' })).toHaveTextContent('MIT License')
    expect(screen.getByRole('region', { name: 'Trademarks' })).toHaveTextContent(
      'not affiliated with, endorsed by or sponsored by Anthropic, Microsoft or Atlassian',
    )
  })
})
