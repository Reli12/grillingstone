// A system line in the chat (the tool speaking), coloured by its tone.
import { cn } from '@/lib/cn'
import type { SystemMessage } from '@/types/chat'

const SYSTEM_TONE_CLASS: Record<NonNullable<SystemMessage['tone']>, string> = {
  info: 'text-ink-faint',
  success: 'font-medium text-proof',
  error: 'text-redpencil',
}

export function SystemLine({ message }: Readonly<{ message: SystemMessage }>) {
  return (
    <p className={cn('mx-auto max-w-[90%] text-center text-[13px]', SYSTEM_TONE_CLASS[message.tone ?? 'info'])}>
      {message.text}
    </p>
  )
}
