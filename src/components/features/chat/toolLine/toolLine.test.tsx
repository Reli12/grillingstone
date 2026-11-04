// Tests for ToolLine: how a refused tool call reads, an Excluded File in particular.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ToolLine } from '@/components/features/chat/toolLine/toolLine'
import { render } from '@test/utils/testUtils'

const at = '2026-11-04T10:00:00Z'

describe('ToolLine', () => {
  it('says a refused code read hit an Excluded File', () => {
    render(
      <ToolLine
        message={{
          id: 'm1',
          at,
          role: 'tool',
          tool: 'mcp__code__read_code_file',
          summary: 'Read app: .env',
          outcome: 'denied',
        }}
      />,
    )
    expect(screen.getByText('Read app: .env')).toBeInTheDocument()
    expect(screen.getByText('(Excluded File — not read)')).toBeInTheDocument()
  })

  it('still calls any other refusal a block by the session allowlist', () => {
    render(
      <ToolLine
        message={{ id: 'm1', at, role: 'tool', tool: 'Bash', summary: 'Tried to run `ls`', outcome: 'denied' }}
      />,
    )
    expect(screen.getByText('(blocked by the session allowlist)')).toBeInTheDocument()
  })
})
