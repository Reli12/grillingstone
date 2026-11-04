// A finished Prototype: its Draft version and time, which open it in a new browser tab, which kind of session wrote it,
// where it started from, Open session (when a Prototype Grilling Session wrote it), Create Draft…, Download, and
// Delete after a confirmation.
import { useState } from 'react'
import { Link } from 'react-router'

import type { Prototype } from '#core/prototype/prototypeRecords.ts'
import { plural } from '#core/shared/plural.ts'

import { useDeletePrototype } from '@/api/hooks/prototypes/prototypeHooks'
import { Button } from '@/components/atoms/button/button'
import { CreateDraftDialog } from '@/components/features/prototypes/createDraftDialog/createDraftDialog'
import { DeletePrototypeDialog } from '@/components/features/prototypes/deletePrototypeDialog/deletePrototypeDialog'
import { DownloadLink } from '@/components/features/prototypes/downloadLink/downloadLink'
import { prototypeLabel, writerLabel } from '@/lib/prototypeLabel'
import { routesPaths } from '@/routes/routes'

interface FinishedRowProps {
  prototype: Prototype
  /** "started from v1 · …", or "started from a deleted Prototype"; absent when it started from scratch. */
  startedFrom: string | undefined
}

/** A finished Prototype: its Draft version and time, which open it in a new browser tab, and where it started from. */
export function FinishedRow({ prototype, startedFrom }: Readonly<FinishedRowProps>) {
  const [confirming, setConfirming] = useState(false)
  const [creatingDraft, setCreatingDraft] = useState(false)
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
        <p className="text-[13px] text-ink-soft">{writerLabel(prototype.writtenBy)}</p>
        {!!startedFrom && <p className="text-[13px] text-ink-soft">{startedFrom}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {prototype.writtenBy.kind === 'prototypeGrilling' && (
          <Link
            to={routesPaths.prototypeGrillingSession(prototype.projectId, prototype.writtenBy.sessionId)}
            className="inline-flex h-7 items-center rounded-md border border-line bg-sheet px-2.5 text-[13px] font-medium text-ink hover:border-ink-faint"
          >
            Open session
          </Link>
        )}
        <Button size="sm" variant="quiet" onClick={() => setCreatingDraft(true)}>
          Create Draft…
        </Button>
        <DownloadLink prototype={prototype} />
        <Button size="sm" variant="quiet" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      {creatingDraft && (
        <CreateDraftDialog
          open
          onClose={() => setCreatingDraft(false)}
          projectId={prototype.projectId}
          prototypeId={prototype.id}
        />
      )}
      <DeletePrototypeDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onDelete={() => remove.mutate(prototype.id, { onSettled: () => setConfirming(false) })}
      />
    </div>
  )
}
