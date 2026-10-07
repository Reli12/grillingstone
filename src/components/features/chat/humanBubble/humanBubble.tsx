// The human's message bubble in the chat.
import { cn } from '@/lib/cn'
import type { HumanMessage } from '@/types/chat'

export function HumanBubble({ message }: Readonly<{ message: HumanMessage }>) {
  return (
    <div className="flex justify-end">
      <p
        className={cn(
          'max-w-[85%] rounded-lg px-3.5 py-2 text-[15px] whitespace-pre-wrap',
          message.kind === 'write' ? 'bg-proof text-on-accent' : 'bg-ink text-on-ink',
        )}
      >
        {message.text}
      </p>
    </div>
  )
}
