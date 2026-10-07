import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'

interface ReadyCardProps {
  summary: string
  target: string
  open: boolean
  onWrite: () => void
  onAdd: () => void
}

/** `target` is what gets written, e.g. "the Draft", "the Proposal", "the Template". */
export function ReadyCard({ summary, target, open, onWrite, onAdd }: ReadyCardProps) {
  return (
    <div
      className={cn('rounded-lg border-2 px-4 py-3.5', open ? 'border-proof bg-proof-wash' : 'border-line bg-sheet')}
    >
      <p className="font-semibold text-proof">Ready to write {target}</p>
      {summary && <p className="mt-1 text-sm text-ink">{summary}</p>}
      {open ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">Anything you want to add before Claude writes it?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="proof" onClick={onWrite}>
              Write {target}
            </Button>
            <Button variant="outline" onClick={onAdd}>
              I want to add something
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
