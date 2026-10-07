// A white box with a small caption, holding one version of the text.
import type { ReactNode } from 'react'

/** A white box with a small caption, holding one version of the text. */
export function VersionBox({ caption, children }: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="rounded border border-line bg-sheet px-3 py-2">
      <p className="mb-1 text-[12px] font-medium text-ink-faint">{caption}</p>
      {children}
    </div>
  )
}
