// On a Draft created from a Prototype: which one, or that it has been deleted. History only.
import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { createdFromLabel } from '@/lib/prototypeLabel'
import { finishedPrototypes } from '@/lib/prototypeRows'

interface CreatedFromPrototypeProps {
  projectId: string
  prototypeId: string
}

/** "Created from Prototype v2 · …", or "Created from a deleted Prototype". */
export function CreatedFromPrototype({ projectId, prototypeId }: Readonly<CreatedFromPrototypeProps>) {
  const { data: rows } = useProjectPrototypeRows(projectId)
  if (rows === undefined) return null
  return (
    <p className="text-[13px] text-ink-faint" data-testid="created-from-prototype">
      {createdFromLabel(prototypeId, finishedPrototypes(rows))}
    </p>
  )
}
