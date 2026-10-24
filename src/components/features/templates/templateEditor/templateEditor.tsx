// The Template editor: name, Iteration Log, the ordered Sections and the writing method. Saving
// writes the next version; Defaults are read-only and offer a copy instead.
import { useState } from 'react'

import type { Template } from '#core/template/templateTypes.ts'

import { CustomFieldsEditor } from '@/components/features/templates/customFieldsEditor/customFieldsEditor'
import { DeleteTemplateDialog } from '@/components/features/templates/deleteTemplateDialog/deleteTemplateDialog'
import { DuplicateBanner } from '@/components/features/templates/duplicateBanner/duplicateBanner'
import { GeneralFields } from '@/components/features/templates/generalFields/generalFields'
import { MethodField } from '@/components/features/templates/methodField/methodField'
import { SaveBar } from '@/components/features/templates/saveBar/saveBar'
import { SectionsEditor } from '@/components/features/templates/sectionsEditor/sectionsEditor'
import { TargetOptions } from '@/components/features/templates/targetOptions/targetOptions'
import { TemplateHeader } from '@/components/features/templates/templateHeader/templateHeader'
import { toForm, useTemplateForm } from '@/hooks/templates/useTemplateForm'
import { useTemplateTargets } from '@/hooks/templates/useTemplateTargets'

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
  const fields = useTemplateTargets(template, editor)
  const targetOptions = <TargetOptions targets={fields.targets} />
  const formPart = { register, errors, readOnly }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-4xl px-4 py-10">
      <TemplateHeader template={template} />
      {readOnly && <DuplicateBanner template={template} />}
      <GeneralFields {...formPart} targetOptions={targetOptions} />
      {fields.takesCustomFields && (
        <CustomFieldsEditor
          names={fields.customFields}
          inUse={fields.customFieldsInUse}
          readOnly={readOnly}
          error={fields.customFieldError}
          onChange={fields.setCustomFields}
        />
      )}

      <SectionsEditor {...formPart} editor={editor} targetOptions={targetOptions} firstTarget={fields.firstTarget} />

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
