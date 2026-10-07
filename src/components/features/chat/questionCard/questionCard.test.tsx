// Tests for QuestionCard: the three ways to answer, and the closed card's note.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'

const question = {
  type: 'question' as const,
  question: 'Keep telemetry?',
  recommended: 'Yes, alerts muted',
  options: ['No'],
}

describe('QuestionCard', () => {
  it('answers with the recommendation, an option or free text', async () => {
    const onAnswer = vi.fn()
    render(<QuestionCard q={question} canAnswer onAnswer={onAnswer} />)
    await userEvent.click(screen.getByRole('button', { name: /Recommended/ }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), ' Only for billing {Enter}')
    expect(onAnswer.mock.calls).toEqual([['Yes, alerts muted'], ['No'], ['Only for billing']])
  })

  it('shows the recommendation when it cannot be answered', () => {
    render(<QuestionCard q={question} canAnswer={false} onAnswer={() => {}} />)
    expect(screen.getByText('Recommended: Yes, alerts muted')).toBeInTheDocument()
  })

  it('says when it was answered', () => {
    render(<QuestionCard q={question} answer="No" canAnswer onAnswer={() => {}} />)
    expect(screen.getByText('Answered below')).toBeInTheDocument()
  })
})
