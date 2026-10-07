// All messages of one session, each drawn by its role; only Claude's latest turn can be answered.
import { ClaudeTurn } from '@/components/features/chat/claudeTurn/claudeTurn'
import { HumanBubble } from '@/components/features/chat/humanBubble/humanBubble'
import { SystemLine } from '@/components/features/chat/systemLine/systemLine'
import { ToolLine } from '@/components/features/chat/toolLine/toolLine'
import type { AnyTranscript, Handlers, HumanMessage } from '@/types/chat'

interface MessagesProps extends Handlers {
  transcript: AnyTranscript
  live: boolean
}

export function Messages({ transcript, live, ...handlers }: Readonly<MessagesProps>) {
  const { messages } = transcript
  const lastClaude = messages.findLastIndex((message) => message.role === 'claude')
  const canAct = live && transcript.status === 'waiting'
  return (
    <div className="space-y-3.5">
      {messages.map((message, i) => {
        if (message.role === 'human') return <HumanBubble key={message.id} message={message} />
        if (message.role === 'system') return <SystemLine key={message.id} message={message} />
        if (message.role === 'tool') return <ToolLine key={message.id} message={message} />
        const answer = messages.slice(i + 1).find((later): later is HumanMessage => later.role === 'human')
        return (
          <ClaudeTurn
            key={message.id}
            message={message}
            transcript={transcript}
            answer={answer}
            actionable={canAct && i === lastClaude}
            handlers={handlers}
          />
        )
      })}
    </div>
  )
}
