// Template editor: one Custom Field a Jira Template names, removable unless a Section or the Iteration Log uses it.
import { X } from 'lucide-react'

interface CustomFieldChipProps {
  name: string
  inUse: boolean
  readOnly: boolean
  onRemove: () => void
}

export function CustomFieldChip({ name, inUse, readOnly, onRemove }: Readonly<CustomFieldChipProps>) {
  return (
    <li className="flex items-center gap-1 rounded-md bg-claude-wash px-2 py-1 text-sm text-claude">
      {name}
      {!readOnly && (
        <button
          type="button"
          aria-label={`Remove Custom Field ${name}`}
          title={inUse ? 'Still used by a Section or the Iteration Log' : 'Remove'}
          disabled={inUse}
          onClick={onRemove}
          className="rounded hover:bg-claude/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <X size={13} />
        </button>
      )}
    </li>
  )
}
