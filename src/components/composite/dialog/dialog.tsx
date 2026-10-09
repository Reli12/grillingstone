// The app's modal dialog: a title bar with a close button, a scrolling body and an optional footer.
import { type ReactNode, useEffect, useId, useRef } from 'react'

import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children, footer, className }: Readonly<DialogProps>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      // Named by its title, so assistive tech (and role-based tests) can tell one dialog from another.
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the <dialog> itself, not on its content, is a click on the backdrop.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        'm-auto w-[min(640px,calc(100vw-32px))] rounded-lg bg-sheet p-0 text-ink shadow-[0_20px_60px_-20px_var(--color-shadow)] backdrop:bg-backdrop',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-ink-faint hover:bg-fog hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
