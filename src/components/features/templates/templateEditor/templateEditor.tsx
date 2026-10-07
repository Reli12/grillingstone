// The Template editor: name, Iteration Log, the ordered Sections and the writing method. Saving
// writes the next version; Defaults are read-only and offer a copy instead.
import { useState } from 'react'

import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'
import { allowedTargets } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { DeleteTemplateDialog } from '@/components/features/templates/deleteTemplateDialog/deleteTemplateDialog'
import { DuplicateBanner } from '@/components/features/templates/duplicateBanner/duplicateBanner'
import { GeneralFields } from '@/components/features/templates/generalFields/generalFields'
import { MethodField } from '@/components/features/templates/methodField/methodField'
import { SaveBar } from '@/components/features/templates/saveBar/saveBar'
import { SectionsEditor } from '@/components/features/templates/sectionsEditor/sectionsEditor'
import { TemplateHeader } from '@/components/features/templates/templateHeader/templateHeader'
import { toForm, useTemplateForm } from '@/hooks/templates/useTemplateForm'

interface TemplateEditorProps {
  template: Template
}

/** Edits one Template; Defaults are read-only and offer a copy instead. Saving bumps the version. */
export function TemplateEditor({ template }: Readonly<TemplateEditorProps>) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editor = useTemplateForm(template)
  const { form, onSave, saving } = editor
  const { register, formState, reset } = form
  const errors = formState.errors

  const readOnly = template.isDefault
  const targets = allowedTargets(template.workItemType)
  const targetOptions = targets.map((target) => (
    <option key={target} value={target}>
      → {ADO_FIELD_LABELS[target]}
    </option>
  ))
  const formPart = { register, errors, readOnly }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-4xl px-4 py-10">
      <TemplateHeader template={template} />
      {readOnly && <DuplicateBanner template={template} />}
      <GeneralFields {...formPart} targetOptions={targetOptions} />

      <SectionsEditor {...formPart} editor={editor} targetOptions={targetOptions} firstTarget={targets[0]} />

      <MethodField register={register} readOnly={readOnly} error={errors.method?.message} />

      {!readOnly && (
        <SaveBar
          nextVersion={template.version + 1}
          dirty={formState.isDirty}
          saving={saving}
          onDiscard={() => reset(toForm(template))}
          onDelete={() => setConfirmDelete(true)}
        />
      )}

      <DeleteTemplateDialog template={template} open={confirmDelete} onClose={() => setConfirmDelete(false)} />
    </form>
  )
}
