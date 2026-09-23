import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Segment } from '#core/session/blockExtractor.ts'
import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'
import { messageSchema, type MessageFormData } from '@/lib/formSchemas/messageSchema'

type Question = Extract<Segment, { type: 'question' }>

interface QuestionCardProps {
  q: Question
  /** The human's reply, once given. */
  answer?: string
  canAnswer: boolean
  onAnswer: (text: string) => void
}

export function QuestionCard({ q, answer, canAnswer, onAnswer }: QuestionCardProps) {
  const { register, handleSubmit, formState } = useForm<MessageFormData>({ resolver: zodResolver(messageSchema), mode: 'onChange', defaultValues: { text: '' } })

  const open = canAnswer && answer === undefined
  return (
    <div className={cn('rounded-lg border bg-sheet', open ? 'border-claude/50 shadow-[0_1px_0_var(--color-claude)]' : 'border-line')}>
      <p className="px-4 pt-3.5 font-medium text-ink">{q.question}</p>
      {open ? (
        <div className="space-y-2.5 px-4 pt-3 pb-4">
          <button onClick={() => onAnswer(q.recommended)} className="group flex w-full items-start gap-2.5 rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-left text-sm hover:border-claude">
            <Check size={16} className="mt-0.5 shrink-0 text-claude" />
            <span>
              <span className="font-semibold text-claude">Recommended</span>
              <span className="block text-ink">{q.recommended}</span>
            </span>
          </button>
          {q.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o) => (
                <Button key={o} size="sm" variant="outline" className="h-auto min-h-7 py-1 text-left whitespace-normal" onClick={() => onAnswer(o)}>
                  {o}
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
      ) : (
        <p className="px-4 pt-1 pb-3.5 text-[13px] text-ink-faint">
          {answer !== undefined ? 'Answered below' : `Recommended: ${q.recommended}`}
        </p>
      )}
    </div>
  )
}
