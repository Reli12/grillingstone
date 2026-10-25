// The human's message bubble in the chat: their words, and the Images they sent as numbered thumbnails.
import { BubbleImages } from '@/components/features/chat/bubbleImages/bubbleImages'
import { cn } from '@/lib/cn'
import type { HumanMessage } from '@/types/chat'

interface HumanBubbleProps {
  message: HumanMessage
  /** Where this session's saved Images are served from; absent for sessions that take no Images. */
  imageUrl?: (number: number) => string
}

export function HumanBubble({ message, imageUrl }: Readonly<HumanBubbleProps>) {
  const images = message.images ?? []
  return (
    <div className="flex flex-col items-end gap-1.5">
      {imageUrl && images.length > 0 && <BubbleImages images={images} imageUrl={imageUrl} />}
      {message.text && (
        <p
          className={cn(
            'max-w-[85%] rounded-lg px-3.5 py-2 text-[15px] whitespace-pre-wrap',
            message.kind === 'write' ? 'bg-proof text-on-accent' : 'bg-ink text-on-ink',
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
