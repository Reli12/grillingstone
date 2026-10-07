// A question Claude asked, as a card: one click for the recommended answer or an option, or a typed reply.
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { AnswerChoices } from '@/components/features/chat/answerChoices/answerChoices'
import { cn } from '@/lib/cn'
import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'
import type { Question } from '@/types/chat'

interface QuestionCardProps {
  q: Question
  /** The human's reply, once given. */
  answer?: string
  canAnswer: boolean
  onAnswer: (text: string) => void
}

export function QuestionCard({ q: question, answer, canAnswer, onAnswer }: Readonly<QuestionCardProps>) {
  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    mode: 'onChange',
    defaultValues: { text: '' },
  })
  const open = canAnswer && answer === undefined
  const closedNote = answer !== undefined ? 'Answered below' : `Recommended: ${question.recommended}`
  return (
    <div
      className={cn(
        'rounded-lg border bg-sheet',
        open ? 'border-claude/50 shadow-[0_1px_0_var(--color-claude)]' : 'border-line',
      )}
    >
      <p className="px-4 pt-3.5 font-medium text-ink">{question.question}</p>
      {open ? (
        <AnswerChoices question={question} form={form} onAnswer={onAnswer} />
      ) : (
        <p className="px-4 pt-1 pb-3.5 text-[13px] text-ink-faint">{closedNote}</p>
      )}
    </div>
  )
}
