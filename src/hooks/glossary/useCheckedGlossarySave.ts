// Saving the Glossary against the version an edit started from. The server refuses a save made against an
// older version (Claude or another tab changed it meanwhile); the caller then gets the latest Glossary.
import { useQueryClient } from '@tanstack/react-query'

import type { GlossaryDoc } from '#core/contract/apiTypes.ts'

import { ApiError } from '@/api/apiError'
import { useGlossary, useSaveGlossary } from '@/api/hooks/projects/projectHooks'
import { queryKeys } from '@/api/reactQueryKeys'

const STALE = 409
const NO_LATEST = 'Could not load the latest Glossary.'

interface Outcome {
  onSaved: () => void
  /** The save was refused as stale; `latest` is the Glossary as it is now. */
  onRefused: (latest: GlossaryDoc) => void
  /** The save failed for any other reason. */
  onFailed: (reason: string) => void
}

export function useCheckedGlossarySave(projectId: string) {
  const qc = useQueryClient()
  // Watching the Glossary keeps it loaded, so a refused save's reload (in useSaveGlossary) fetches the latest.
  useGlossary(projectId)
  const save = useSaveGlossary(projectId)
  const saveChecked = (base: GlossaryDoc, markdown: string, { onSaved, onRefused, onFailed }: Outcome) =>
    save.mutate(
      { markdown, baseVersion: base.version },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (!(error instanceof ApiError && error.status === STALE)) return onFailed(error.message)
          // useSaveGlossary has already reloaded the Glossary before this runs, so the cache holds the latest.
          const latest = qc.getQueryData<GlossaryDoc>(queryKeys.glossary(projectId))
          if (latest && latest.version !== base.version) onRefused(latest)
          else onFailed(NO_LATEST)
        },
      },
    )
  return { saveChecked, saving: save.isPending }
}
