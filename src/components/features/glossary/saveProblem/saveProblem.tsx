// Why the last Glossary save did not go through: Claude or another tab changed the Glossary meanwhile, or the
// save failed for another reason. Shows nothing when there was no problem.
import type { SaveStatus } from '@/types/glossary'

interface SaveProblemProps {
  status: SaveStatus
  /** What to do next after a refused save. */
  staleHint: string
}

export function SaveProblem({ status: { stale, failure }, staleHint }: Readonly<SaveProblemProps>) {
  if (!stale && !failure) return null
  return (
    <p role="alert" className="rounded-md bg-redpencil-wash px-3 py-2 text-[13px] text-redpencil-strong">
      {failure ? `Couldn't save: ${failure}` : `The Glossary changed while you were editing. ${staleHint}`}
    </p>
  )
}
