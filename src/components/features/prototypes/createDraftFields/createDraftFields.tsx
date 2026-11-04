// The Create Draft… form: the New Draft form's requirement, Work Item Type and Template, for a Draft created from a
// Prototype. The Prototype is given to the new Draft's first Grilling Session; Images and References are left out.
import type { Project } from '#core/contract/apiTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { DraftTypePicker } from '@/components/features/drafts/draftTypePicker/draftTypePicker'
import { TemplatePicker } from '@/components/features/drafts/templatePicker/templatePicker'
import { useNewDraftForm } from '@/hooks/drafts/useNewDraftForm'

interface CreateDraftFieldsProps {
  project: Project
  templates: Template[]
  prototypeId: string
  onCancel: () => void
}

/** Requirement, Work Item Type and Template; submitting creates the Draft and starts its first Grilling Session. */
export function CreateDraftFields({ project, templates, prototypeId, onCancel }: Readonly<CreateDraftFieldsProps>) {
  const form = useNewDraftForm(project, templates, prototypeId)
  return (
    <form className="space-y-5" onSubmit={form.onSubmit}>
      <p className="text-sm text-ink-soft">
        Claude still grills you before it writes v1, and can see this Prototype, its assumptions and its Images. Nothing
        it shows counts until you confirm it.
      </p>
      <TextArea
        autoFocus
        minRows={4}
        {...form.register('requirement')}
        placeholder="What should this Draft describe?"
        aria-label="Requirement"
      />
      <DraftTypePicker tracker={project.tracker} type={form.type} onChoose={form.chooseType} />
      <TemplatePicker
        templates={form.forType}
        chosenId={form.chosen?.id}
        onChoose={(templateId) => form.setValue('templateId', templateId)}
      />
      <FieldError message={form.create.error?.message} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="claude" disabled={!form.canStart}>
          {form.create.isPending ? 'Creating…' : 'Create Draft'}
        </Button>
      </div>
    </form>
  )
}
