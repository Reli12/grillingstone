// A question Claude asked, as a card: one click for the recommended answer or an option, or a typed reply.
import { useForm, type UseFormReturn } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'

import type { Segment } from '#core/session/blockExtractor.ts'

import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'
import { type MessageFormData, messageSchema } from '@/lib/formSchemas/messageSchema'

type Question = Extract<Segment, { type: 'question' }>

interface QuestionCardProps {
  q: Question
  /** The human's reply, once given. */
  answer?: string
  canAnswer: boolean
  onAnswer: (text: string) => void
}

interface AnswerChoicesProps {
  question: Question
  /** Owned by the card, so a half-typed answer survives the card closing and reopening. */
  form: UseFormReturn<MessageFormData>
  onAnswer: (text: string) => void
}

/** The open card's ways to answer: the recommendation, the offered options, or your own words. */
function AnswerChoices({ question, form, onAnswer }: Readonly<AnswerChoicesProps>) {
  const { register, handleSubmit, formState } = form
  return (
    <div className="space-y-2.5 px-4 pt-3 pb-4">
      <button
        onClick={() => onAnswer(question.recommended)}
        className="group flex w-full items-start gap-2.5 rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-left text-sm hover:border-claude"
      >
        <Check size={16} className="mt-0.5 shrink-0 text-claude" />
        <span>
          <span className="font-semibold text-claude">Recommended</span>
          <span className="block text-ink">{question.recommended}</span>
        </span>
      </button>
      {question.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant="outline"
              className="h-auto min-h-7 py-1 text-left whitespace-normal"
              onClick={() => onAnswer(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      <form className="flex gap-1.5" onSubmit={handleSubmit(({ text }) => onAnswer(text))}>
        <TextInput {...register('text')} placeholder="Or answer in your own words" aria-label="Your answer" />
        <Button type="submit" variant="ink" disabled={!formState.isValid}>
          Answer
        </Button>
      </form>
    </div>
  )
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
