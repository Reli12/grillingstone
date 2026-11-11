import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { copyParts, ViewCopyDialog } from './viewCopyDialog'

const summary: BacklogCopySummary = {
  copy: {
    id: 'ado-100',
    workItemId: 100,
    workItemType: 'Feature',
    title: 'Device archiving',
    content:
      '## Business rules\n\n- BR1 **archive** a device\n- BR2 restore it\n\n| Role | Can |\n| --- | --- |\n| Admin | yes |',
    acceptanceCriteria: '1. AC1\n2. AC2',
    revision: 1,
    pastedAt: '2026-11-10T10:00:00.000Z',
  },
  drafts: [],
}

describe('ViewCopyDialog', () => {
  it('splits the text at its headings', () => {
    expect(copyParts('Intro\n## Rules\n- a')).toEqual([
      { kind: 'text', text: 'Intro' },
      { kind: 'heading', text: 'Rules' },
      { kind: 'text', text: '- a' },
    ])
  })

  it('shows the Copy formatted, not as raw markdown', () => {
    render(<ViewCopyDialog summary={summary} onClose={vi.fn()} onRepaste={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Business rules' })).toBeInTheDocument()
    expect(screen.getByText('archive').tagName).toBe('STRONG')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/##|\*\*/)).not.toBeInTheDocument()
  })
})
