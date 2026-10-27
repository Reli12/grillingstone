// A finished Prototype: its Draft version and time, which open it in a new browser tab, where it started from,
// Download, and Delete after a confirmation.
import { useState } from 'react'
import { Link } from 'react-router'

import type { Prototype } from '#core/prototype/prototypeRecords.ts'
import { plural } from '#core/shared/plural.ts'

import { useDeletePrototype } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { DeletePrototypeDialog } from '@/components/features/prototypes/deletePrototypeDialog/deletePrototypeDialog'
import { DownloadLink } from '@/components/features/prototypes/downloadLink/downloadLink'
import { prototypeLabel } from '@/lib/prototypeLabel'
import { routesPaths } from '@/routes/routes'

interface FinishedRowProps {
  prototype: Prototype
  /** "started from v1 · …", or "started from a deleted Prototype"; absent when it started from scratch. */
  startedFrom: string | undefined
}

/** A finished Prototype: its Draft version and time, which open it in a new browser tab, and where it started from. */
export function FinishedRow({ prototype, startedFrom }: Readonly<FinishedRowProps>) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeletePrototype(prototype.projectId)
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <Link
          to={routesPaths.prototype(prototype.projectId, prototype.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-ink hover:text-claude hover:underline"
        >
          {prototypeLabel(prototype)}
        </Link>
        <p className="text-[13px] text-ink-soft">{plural(prototype.assumptions.length, 'assumption')}</p>
        {!!startedFrom && <p className="text-[13px] text-ink-soft">{startedFrom}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <DownloadLink prototype={prototype} />
        <Button size="sm" variant="quiet" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      <DeletePrototypeDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onDelete={() => remove.mutate(prototype.id, { onSettled: () => setConfirming(false) })}
      />
    </div>
  )
}
