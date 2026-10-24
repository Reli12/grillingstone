// Template editor: the fields this Template's Sections and Iteration Log may be copied into — its Tracker's
// fields for its type, plus, for Jira, the Custom Fields it names — and which Custom Fields are in use.
import { useWatch } from 'react-hook-form'

import {
  customFieldName,
  customFieldTarget,
  isCustomFieldTarget,
  type SectionTarget,
} from '#core/shared/trackerFields.ts'
import { acceptsCustomFields, allowedTargets } from '#core/shared/workItemType.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'

import type { useTemplateForm } from '@/hooks/templates/useTemplateForm'

export function useTemplateTargets(template: Template, editor: ReturnType<typeof useTemplateForm>) {
  const { form, sections } = editor
  const customFields = useWatch({ control: form.control, name: 'customFields' })
  const logTarget = useWatch({ control: form.control, name: 'iterationLogTarget' })

  const takesCustomFields = acceptsCustomFields(templateTracker(template))
  const systemTargets = allowedTargets(templateTracker(template), template.workItemType)
  const customTargets = takesCustomFields ? customFields.map(customFieldTarget) : []
  const usedTargets = [...sections.map((section) => section.target), logTarget]
  // One message per misnamed Custom Field; showing the first is enough to fix them one by one.
  const errors = form.formState.errors.customFields
  const customFieldError = customFields.map((_, i) => errors?.[i]?.message).find(Boolean)

  return {
    targets: [...systemTargets, ...customTargets] as SectionTarget[],
    /** What a new Section targets until the human picks another field. */
    firstTarget: systemTargets[0],
    takesCustomFields,
    customFields,
    customFieldsInUse: usedTargets.filter(isCustomFieldTarget).map(customFieldName),
    customFieldError,
    setCustomFields: (names: string[]) =>
      form.setValue('customFields', names, { shouldDirty: true, shouldValidate: true }),
  }
}
