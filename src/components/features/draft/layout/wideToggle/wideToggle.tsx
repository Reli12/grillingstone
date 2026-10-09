// The icon button that widens the Draft page's side panel to about 60%, or narrows it back.
import { Maximize2, Minimize2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'

interface WideToggleProps {
  wide: boolean
  onWideChange: (wide: boolean) => void
  className?: string
}

/** Desktop only: on small screens the panel is already full-screen, so there is nothing to widen. */
export function WideToggle({ wide, onWideChange, className }: Readonly<WideToggleProps>) {
  const label = wide ? 'Narrow panel' : 'Widen panel'
  return (
    <Button
      size="sm"
      variant="quiet"
      aria-label={label}
      title={label}
      aria-pressed={wide}
      onClick={() => onWideChange(!wide)}
      className={cn('hidden lg:inline-flex', className)}
    >
      {wide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </Button>
  )
}
