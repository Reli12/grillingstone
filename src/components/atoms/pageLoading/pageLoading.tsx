// The placeholder a page shows, centred, while its data loads.
import { Thinking } from '@/components/atoms/thinking/thinking'

export function PageLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Thinking label="Loading" className="text-ink-faint" />
    </div>
  )
}
