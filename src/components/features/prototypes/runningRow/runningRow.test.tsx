// Tests for a running Prototype row (user story 64): when it started, how long it has run (ticking in the browser),
// and Claude's latest step.
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { v1Draft } from '#core/testing/fixtures.ts'

import { RunningRow } from '@/components/features/prototypes/runningRow/runningRow'
import { whenLabel } from '@/lib/prototypeLabel'
import { sessionOf } from '@test/mocks/prototypeBackend'
import { render } from '@test/utils/testUtils'

const draft = v1Draft()
const startedAt = '2026-10-25T10:00:00Z'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: new Date('2026-10-25T10:03:05Z') })
})
afterEach(() => vi.useRealTimers())

describe('RunningRow', () => {
  it('shows when it started and how long it has run, and the elapsed time ticks', () => {
    render(<RunningRow session={sessionOf(draft, { startedAt })} />)

    expect(screen.getByText(`Started ${whenLabel(startedAt)} · 3m 05s`)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(`Started ${whenLabel(startedAt)} · 3m 06s`)).toBeInTheDocument()
  })

  it('shows Claude’s latest step, and changes it with the session', () => {
    const { rerender } = render(<RunningRow session={sessionOf(draft, { step: 'reading' })} />)
    expect(screen.getByText('Reading the Draft')).toBeInTheDocument()

    rerender(<RunningRow session={sessionOf(draft, { step: 'editing' })} />)
    expect(screen.getByText('Editing prototype.html')).toBeInTheDocument()
    expect(screen.queryByText('Reading the Draft')).not.toBeInTheDocument()
  })

  it.each([
    ['writing', 'Writing prototype.html'],
    ['submitted', 'Submitted, checking it'],
    ['fixing', 'Fixing what the check refused'],
  ] as const)('words the %s step', (step, words) => {
    render(<RunningRow session={sessionOf(draft, { step })} />)
    expect(screen.getByText(words)).toBeInTheDocument()
  })

  it('shows no step line before Claude has done anything', () => {
    render(<RunningRow session={sessionOf(draft)} />)
    expect(screen.queryByTestId('prototype-step')).not.toBeInTheDocument()
  })

  it('stops ticking when the row goes away', () => {
    const { unmount } = render(<RunningRow session={sessionOf(draft, { startedAt })} />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
