// The "start from nothing" choice, listed before the type's Templates.
import type { Template } from '#core/template/templateTypes.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { Tag } from '@/components/atoms/tag/tag'
import { cn } from '@/lib/cn'

/** The "start from nothing" choice, listed before the type's Templates. */
const NOTHING = { id: '', name: 'Nothing', isDefault: false }

interface BasePickerProps {
  /** The chosen type's Templates. */
  templates: Template[]
  baseId: string
  onChoose: (baseId: string) => void
}

export function BasePicker({ templates, baseId, onChoose }: Readonly<BasePickerProps>) {
  return (
    <fieldset>
      <FieldLabel hint="Read as a starting point. It is never changed — you always get a new Template.">
        Start from
      </FieldLabel>
      <div className="space-y-1.5">
        {[NOTHING, ...templates].map((option) => (
          <label
            key={option.id || 'nothing'}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm',
              baseId === option.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
            )}
          >
            <input
              type="radio"
              name="base"
              className="accent-claude"
              checked={baseId === option.id}
              onChange={() => onChoose(option.id)}
            />
            <span className="flex-1 font-medium">{option.name}</span>
            {option.isDefault && <Tag>Default</Tag>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
