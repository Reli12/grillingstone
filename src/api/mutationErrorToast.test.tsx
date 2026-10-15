// Tests for the toast a failed action shows: its message, and a way to Settings when the Assistant cannot run.
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ASSISTANT_UNAVAILABLE } from '#core/contract/apiTypes.ts'

import { ApiError } from '@/api/apiError'
import { toastMutationError } from '@/api/mutationErrorToast'
import { render } from '@test/utils/testUtils'

describe('toastMutationError', () => {
  it('offers Settings when the Assistant cannot run', async () => {
    const openSettings = vi.fn()
    const { user } = render(<div />)
    const error = new ApiError('Codex isn’t signed in. Run `codex login`.', 409, undefined, ASSISTANT_UNAVAILABLE)
    toastMutationError(error, openSettings)

    expect(await screen.findByText(/Codex isn’t signed in/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Settings' }))
    expect(openSettings).toHaveBeenCalled()
  })

  it('shows any other failure as its message alone', async () => {
    render(<div />)
    toastMutationError(new ApiError('Stop the running session first.', 409), vi.fn())
    expect(await screen.findByText('Stop the running session first.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Settings' })).not.toBeInTheDocument()
  })
})
