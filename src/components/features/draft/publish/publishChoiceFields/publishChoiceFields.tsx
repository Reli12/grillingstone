// What the human chooses at the top of the Publish dialog: for a Draft not linked yet, whether to create a new item or
// update an existing one (which links the Draft to it); and the parent, by ID or link, so it need not be imported as
// a Backlog Copy first.
import type { ParentChoice } from '@/api/adoApi'
import { WorkItemField } from '@/components/features/draft/publish/workItemField/workItemField'

/** The parent Publish adds: the Draft's Parent, or a work item ID or link typed here. Blank: the Draft's Parent. */
export function ParentField({
  choice,
  applied,
  checking,
  onApply,
}: Readonly<{ choice: ParentChoice; applied: string; checking: boolean; onApply: (parent: string) => void }>) {
  const { workItemId, title, adoType } = choice
  return (
    <WorkItemField
      label="Parent"
      hint="The work item this one goes under: its ID or a link to it. Leave it empty to use the Draft’s Parent."
      current={applied || (workItemId ? `#${workItemId}` : '')}
      checking={checking}
      onApply={onApply}
      found={workItemId && title ? `${adoType} #${workItemId} · ${title}` : null}
    />
  )
}

export type PublishTarget = 'new' | 'existing'

interface TargetFieldProps {
  target: PublishTarget
  onTarget: (target: PublishTarget) => void
  existing: string
  checking: boolean
  onExisting: (existing: string) => void
}

/** For a Draft not linked yet: create a new item (the default), or update an existing one and link the Draft to it. */
export function TargetField({ target, onTarget, existing, checking, onExisting }: Readonly<TargetFieldProps>) {
  const option = (value: PublishTarget, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="publish-target" checked={target === value} onChange={() => onTarget(value)} />
      {label}
    </label>
  )
  return (
    <fieldset className="space-y-1.5">
      <legend className="sr-only">Publish as</legend>
      {option('new', 'Create a new work item')}
      {option('existing', 'Update an existing work item')}
      {target === 'existing' && (
        <div className="pt-1 pl-6">
          <WorkItemField
            label="Existing work item"
            hint="Its ID or a link to it, in this Project’s Backlog and of the Draft’s type. Publishing links the Draft to it."
            current={existing}
            checking={checking}
            onApply={onExisting}
          />
        </div>
      )}
    </fieldset>
  )
}
