// New Draft: the "Start grilling" button and what happens next.
import { Button } from '@/components/atoms/button/button'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

export function StartButton({ disabled, starting }: Readonly<{ disabled: boolean; starting: boolean }>) {
  const assistant = useAssistantLabel()
  return (
    <div>
      <Button type="submit" variant="claude" size="lg" className="w-full" disabled={disabled}>
        {starting ? 'Starting…' : 'Start grilling'}
      </Button>
      <p className="mt-2 text-[13px] text-ink-faint">
        {assistant} asks one question at a time. Nothing is written until you confirm.
      </p>
    </div>
  )
}
