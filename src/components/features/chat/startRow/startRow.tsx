// Under the box: the hint, and Send (which reads "Starting…" while the session spins up).
import { Button } from '@/components/atoms/button/button'

interface StartRowProps {
  hint?: string
  starting: boolean
  canSend: boolean
  onSend: () => void
}

/** Under the box: the hint, and Send (which reads "Starting…" while the session spins up). */
export function StartRow({ hint, starting, canSend, onSend }: Readonly<StartRowProps>) {
  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      {hint && <span className="pl-1 text-[13px] text-ink-faint">{hint}</span>}
      <span className="ml-auto" />
      <Button size="sm" variant="claude" disabled={!canSend} onClick={onSend}>
        {starting ? 'Starting…' : 'Send'}
      </Button>
    </div>
  )
}
