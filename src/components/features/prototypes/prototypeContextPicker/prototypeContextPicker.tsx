// Starting a Grilling Session: tick Prototypes of the Project Claude may read as context, styled like the References.
import { useProjectPrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { cn } from '@/lib/cn'
import { prototypeLabel } from '@/lib/prototypeLabel'
import { finishedPrototypes } from '@/lib/prototypeRows'

interface PrototypeContextPickerProps {
  projectId: string
  /** The ids ticked so far. */
  prototypeIds: string[]
  onToggle: (prototypeId: string) => void
}

/** Tick Prototypes of the Project Claude may read as context; nothing is shown while the Project has none. */
export function PrototypeContextPicker({ projectId, prototypeIds, onToggle }: Readonly<PrototypeContextPickerProps>) {
  const { data: rows } = useProjectPrototypeRows(projectId)
  const prototypes = finishedPrototypes(rows ?? [])
  if (prototypes.length === 0) return null
  return (
    <fieldset className="mt-6">
      <FieldLabel hint="Claude reads their pages and assumptions, but nothing in them counts until you confirm it.">
        Prototypes (optional)
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {prototypes.map((prototype) => {
          const on = prototypeIds.includes(prototype.id)
          return (
            <label
              key={prototype.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                on ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
              )}
            >
              <input type="checkbox" className="accent-claude" checked={on} onChange={() => onToggle(prototype.id)} />
              {prototypeLabel(prototype)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
