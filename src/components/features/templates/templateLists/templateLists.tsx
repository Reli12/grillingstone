// One list per Work Item Type of the chosen Tracker, in that Tracker's type order.
import type { Tracker } from '#core/shared/tracker.ts'
import { workItemTypes } from '#core/shared/workItemType.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'

import { TemplateRow } from '@/components/features/templates/templateRow/templateRow'

interface TemplateListsProps {
  tracker: Tracker
  templates: Template[]
  selected: Set<string>
  duplicating: boolean
  onToggle: (templateId: string) => void
  onDuplicate: (template: Template) => void
}

/** One list per Work Item Type of the chosen Tracker, in that Tracker's type order. */
export function TemplateLists({
  tracker,
  templates,
  selected,
  duplicating,
  onToggle,
  onDuplicate,
}: Readonly<TemplateListsProps>) {
  const ofTracker = templates.filter((template) => templateTracker(template) === tracker)
  return workItemTypes(tracker).map((type) => (
    <section key={type} className="mt-10">
      <h2 className="mb-3 font-serif text-xl font-semibold">{type}</h2>
      <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
        {ofTracker
          .filter((template) => template.workItemType === type)
          .map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              selected={selected.has(template.id)}
              duplicating={duplicating}
              onToggle={() => onToggle(template.id)}
              onDuplicate={() => onDuplicate(template)}
            />
          ))}
      </ul>
    </section>
  ))
}
