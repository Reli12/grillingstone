// Tests for SaveProblem: why the last Glossary save did not go through.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SaveProblem } from '@/components/features/glossary/saveProblem/saveProblem'

describe('SaveProblem', () => {
  it('says the Glossary changed meanwhile, with what to do next', () => {
    render(<SaveProblem status={{ saving: false, stale: true, failure: null }} staleHint="Save again." />)
    expect(screen.getByRole('alert')).toHaveTextContent('The Glossary changed while you were editing. Save again.')
  })

  it('says why a save failed', () => {
    render(<SaveProblem status={{ saving: false, stale: false, failure: 'Disk full' }} staleHint="Save again." />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save: Disk full")
  })

  it('shows nothing when the last save had no problem', () => {
    const { container } = render(
      <SaveProblem status={{ saving: false, stale: false, failure: null }} staleHint="Save again." />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
