// One list per Work Item Type, in the fixed type order.
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { TemplateRow } from '@/components/features/templates/templateRow/templateRow'

interface TemplateListsProps {
  templates: Template[]
  selected: Set<string>
  duplicating: boolean
  onToggle: (templateId: string) => void
  onDuplicate: (template: Template) => void
}

/** One list per Work Item Type, in the fixed type order. */
export function TemplateLists({
  templates,
  selected,
  duplicating,
  onToggle,
  onDuplicate,
}: Readonly<TemplateListsProps>) {
  return WORK_ITEM_TYPES.map((type) => (
    <section key={type} className="mt-10">
      <h2 className="mb-3 font-serif text-xl font-semibold">{type}</h2>
      <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
        {templates
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
