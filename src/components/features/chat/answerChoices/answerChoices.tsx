// The open card's ways to answer: the recommendation, the offered options, or your own words.
import { type UseFormReturn } from 'react-hook-form'

import { Check } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { type MessageFormData } from '@/lib/formSchemas/messageSchema'
import type { Question } from '@/types/chat'

interface AnswerChoicesProps {
  question: Question
  /** Owned by the card, so a half-typed answer survives the card closing and reopening. */
  form: UseFormReturn<MessageFormData>
  onAnswer: (text: string) => void
}

/** The open card's ways to answer: the recommendation, the offered options, or your own words. */
export function AnswerChoices({ question: { recommended, options }, form, onAnswer }: Readonly<AnswerChoicesProps>) {
  const { register, handleSubmit, formState } = form
  return (
    <div className="space-y-2.5 px-4 pt-3 pb-4">
      {recommended && (
        <button
          onClick={() => onAnswer(recommended)}
          className="group flex w-full items-start gap-2.5 rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-left text-sm hover:border-claude"
        >
          <Check size={16} className="mt-0.5 shrink-0 text-claude" />
          <span>
            <span className="font-semibold text-claude">Recommended</span>
            <span className="block text-ink">{recommended}</span>
          </span>
        </button>
      )}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
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
