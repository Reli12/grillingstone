// Template editor, Jira only: the Custom Fields the team added to its work items (e.g. "Acceptance Criteria"),
// which Sections and the Iteration Log can then be copied into. A field still in use cannot be removed.
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { AddCustomField } from '@/components/features/templates/addCustomField/addCustomField'
import { CustomFieldChip } from '@/components/features/templates/customFieldChip/customFieldChip'

interface CustomFieldsEditorProps {
  names: string[]
  /** Names some Section or the Iteration Log is copied into. */
  inUse: string[]
  readOnly: boolean
  error?: string
  onChange: (names: string[]) => void
}

export function CustomFieldsEditor({ names, inUse, readOnly, error, onChange }: Readonly<CustomFieldsEditorProps>) {
  return (
    <div className="mt-5">
      <FieldLabel hint="Fields your Jira team added itself. Each becomes its own copy button, after Description.">
        Custom Fields
      </FieldLabel>
      <ul className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <CustomFieldChip
            key={name}
            name={name}
            inUse={inUse.includes(name)}
            readOnly={readOnly}
            onRemove={() => onChange(names.filter((other) => other !== name))}
          />
        ))}
        {names.length === 0 && <li className="text-sm text-ink-faint">None — everything goes to Jira's own fields.</li>}
      </ul>
      {!readOnly && <AddCustomField onAdd={(name) => onChange([...names, name])} />}
      <FieldError message={error} />
    </div>
  )
}
