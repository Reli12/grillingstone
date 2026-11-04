// The top of a Grilling Session that was given Prototypes: which ones Claude can see.
import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { prototypeLabel } from '@/lib/prototypeLabel'
import { finishedPrototypes } from '@/lib/prototypeRows'

interface GivenPrototypesProps {
  projectId: string
  prototypeIds: string[]
}

/** The Prototypes the session was given, each named like a Prototype row; one deleted since says so. */
export function GivenPrototypes({ projectId, prototypeIds }: Readonly<GivenPrototypesProps>) {
  const { data: rows } = useProjectPrototypeRows(projectId)
  if (rows === undefined) return null
  const all = finishedPrototypes(rows)
  return (
    <div className="mb-4 text-center text-[12px] text-ink-faint" data-testid="given-prototypes">
      <p>Claude can see {prototypeIds.length === 1 ? 'this Prototype' : 'these Prototypes'}:</p>
      <ul>
        {prototypeIds.map((id) => {
          const found = all.find((prototype) => prototype.id === id)
          return <li key={id}>{found ? prototypeLabel(found) : 'a deleted Prototype'}</li>
        })}
      </ul>
    </div>
  )
}
