// One turn of Claude in the chat: its text, plus a Question or Ready Check card when it asks one.
import { RichText } from '@/components/atoms/richText/richText'
import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'
import { ReadyCard } from '@/components/features/chat/readyCard/readyCard'
import { writeTarget } from '@/constants/SessionConstants'
import type { AnyTranscript, ClaudeMessage, Handlers, HumanMessage } from '@/types/chat'

interface ClaudeTurnProps {
  message: ClaudeMessage
  transcript: AnyTranscript
  /** The human's reply to this turn, if one came after it. */
  answer?: HumanMessage
  /** This is Claude's latest turn and the human may answer it now. */
  actionable: boolean
  handlers: Handlers
}

export function ClaudeTurn({ message, transcript, answer, actionable, handlers }: Readonly<ClaudeTurnProps>) {
  return (
    <div className="space-y-3 border-l-2 border-claude/60 pl-3">
      {message.segments.map((segment, index) => {
        if (segment.type === 'text')
          return <RichText key={index} text={segment.text} className="text-[15px] leading-relaxed text-ink" />
        if (segment.type === 'question')
          return (
            <QuestionCard
              key={index}
              q={segment}
              answer={answer?.text}
              canAnswer={actionable}
              onAnswer={(text) => handlers.onAnswer(transcript.id, text)}
            />
          )
        return (
          <ReadyCard
            key={index}
            summary={segment.summary}
            target={writeTarget(transcript.kind)}
            open={actionable && !answer}
            onWrite={() => handlers.onWrite(transcript.id)}
            onAdd={handlers.onAddSomething}
          />
        )
      })}
    </div>
  )
}
