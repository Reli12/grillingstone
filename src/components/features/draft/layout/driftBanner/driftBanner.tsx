// Possible Drift: the Linked Work Item has a newer revision than the Draft knows. Only a Drift Check says whether
// anything the Template publishes changed; the banner never moves the Draft's Lane.
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import type { Draft } from '#core/draft/draftTypes.ts'

import { useDriftCheck, useRevisions } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'

export function DriftBanner({ draft }: Readonly<{ draft: Draft }>) {
  const linked = draft.linkedWorkItem
  const { data: revisions } = useRevisions(draft.projectId, Boolean(linked) && !draft.archived)
  const check = useDriftCheck(draft.projectId, draft.id)
  if (!linked || !revisions?.mayHaveDrift.includes(draft.id)) return null
  const run = () =>
    check.mutate(undefined, {
      onSuccess: ({ drift }) => {
        if (drift.changes.length)
          toast.info(`Brought in ${drift.changes.length} change(s) from Azure DevOps to triage.`)
        else toast.success('No Drift: nothing this Template publishes changed in Azure DevOps.')
        for (const note of drift.notes) toast.warning(note)
      },
      onError: (error) => toast.error(error.message),
    })
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-mark/40 bg-mark-wash px-4 py-2.5 text-sm">
      <p className="flex-1">
        #{linked.id} changed in Azure DevOps since your last Publish — this Draft may have Drift.
      </p>
      <Button size="sm" variant="outline" disabled={check.isPending || Boolean(draft.proposal)} onClick={run}>
        <RefreshCw size={14} className={check.isPending ? 'animate-spin' : ''} /> Check for Drift
      </Button>
    </div>
  )
}
