// The session page's right side: the strip of the session's Prototypes, the one in view with open-in-a-new-tab and
// Download, and that Prototype in the sandboxed frame. It starts on the newest; mounted with a new `key` when a newer
// one is written, it shows that one.
import { useState } from 'react'
import { Link } from 'react-router'

import type { Prototype } from '#core/prototype/prototypeRecords.ts'
import { plural } from '#core/shared/plural.ts'

import { DownloadLink } from '@/components/features/prototypes/downloadLink/downloadLink'
import { PrototypeFrame } from '@/components/features/prototypes/prototypeFrame/prototypeFrame'
import { VersionStrip } from '@/components/features/prototypes/versionStrip/versionStrip'
import { prototypeLabel } from '@/lib/prototypeLabel'
import { routesPaths } from '@/routes/routes'

interface GrillingSessionViewerProps {
  /** The session's Prototypes, oldest round first; at least one. */
  prototypes: [Prototype, ...Prototype[]]
}

/** The strip of the session's Prototypes and the one in view, in the sandboxed frame. */
export function GrillingSessionViewer({ prototypes }: Readonly<GrillingSessionViewerProps>) {
  const [pickedId, setPickedId] = useState<string>()
  const newest = prototypes.at(-1) ?? prototypes[0]
  const current = prototypes.find((prototype) => prototype.id === pickedId) ?? newest
  return (
    <>
      <div className="shrink-0 space-y-2 border-b border-line bg-sheet px-4 py-2">
        <VersionStrip prototypes={prototypes} currentId={current.id} onSelect={setPickedId} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[13px] text-ink-soft">{prototypeLabel(current)}</span>
          <span className="text-[13px] text-ink-soft">{plural(current.assumptions.length, 'assumption')}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <Link
              to={routesPaths.prototype(current.projectId, current.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md border border-line bg-sheet px-2.5 text-[13px] font-medium text-ink hover:border-ink-faint"
            >
              Open in new tab
            </Link>
            <DownloadLink prototype={current} />
          </span>
        </div>
      </div>
      <PrototypeFrame key={current.id} projectId={current.projectId} prototypeId={current.id} />
    </>
  )
}
