// Download for a finished Prototype: the view route as a file, which the browser saves the way it normally does.
import { Download } from 'lucide-react'

import type { Prototype } from '#core/prototype/prototypeRecords.ts'

import { endpoints } from '@/api/endpoints/endpoints'

/** Download for a finished Prototype: one self-contained HTML file named after the Draft, version and time. */
export function DownloadLink({ prototype }: Readonly<{ prototype: Prototype }>) {
  return (
    <a
      href={endpoints.prototypeDownload(prototype.projectId, prototype.id)}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-sheet px-2.5 text-[13px] font-medium text-ink hover:border-ink-faint"
    >
      <Download size={14} aria-hidden /> Download
    </a>
  )
}
