// New Draft: choose the Template for the chosen Work Item Type.
import type { Template } from '#core/template/templateTypes.ts'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { Tag } from '@/components/atoms/tag/tag'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { cn } from '@/lib/cn'

interface TemplatePickerProps {
  /** The Templates of the chosen Work Item Type. */
  templates: Template[]
  chosenId?: string
  onChoose: (templateId: string) => void
}

export function TemplatePicker({ templates, chosenId, onChoose }: Readonly<TemplatePickerProps>) {
  const assistant = useAssistantLabel()
  return (
    <fieldset>
      <FieldLabel hint={`Decides the Sections ${assistant} must write and how.`}>Template</FieldLabel>
      <div className="space-y-1.5">
        {templates.map((template) => (
          <label
            key={template.id}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm',
              chosenId === template.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
            )}
          >
            <input
              type="radio"
              name="template"
              className="mt-1 accent-claude"
              checked={chosenId === template.id}
              onChange={() => onChoose(template.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">
                {template.name}
                {template.isDefault && <Tag>Default</Tag>}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-faint">
                {template.sections.map((section) => section.heading).join(', ')}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
