// The list with the id removed if it was there, or added if it was not.
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import type { Project } from '#core/contract/apiTypes.ts'
import { type WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { useCreateDraft } from '@/api/hooks/drafts/draftHooks'
import { type NewDraftFormData, newDraftSchema } from '@/lib/formSchemas/newDraftSchema'
import { routesPaths } from '@/routes/routes'

/** The list with the id removed if it was there, or added if it was not. */
const toggled = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id]

/**
 * The form's state. The Template shown as chosen is the one picked, else the type's Default, else
 * its first; picking another type clears the pick.
 */
export function useNewDraftForm(project: Project, templates: Template[]) {
  const navigate = useNavigate()
  const { register, handleSubmit, control, setValue, formState } = useForm<NewDraftFormData>({
    resolver: zodResolver(newDraftSchema),
    mode: 'onChange',
    defaultValues: { workItemType: 'PBI', templateId: '', requirement: '', references: [] },
  })
  const create = useCreateDraft(project.id)

  const [type, templateId, references] = useWatch({ control, name: ['workItemType', 'templateId', 'references'] })
  const forType = useMemo(() => templates.filter((template) => template.workItemType === type), [templates, type])
  const picked = forType.find((template) => template.id === templateId)
  const chosen = picked ?? forType.find((template) => template.isDefault) ?? forType[0]

  const onSubmit = handleSubmit(({ templateId: _, ...rest }) => {
    if (!chosen) return
    create.mutate(
      { ...rest, templateId: chosen.id },
      { onSuccess: ({ draft }) => void navigate(routesPaths.draft(project.id, draft.id)) },
    )
  })
  const chooseType = (nextType: WorkItemType) => {
    setValue('workItemType', nextType)
    setValue('templateId', '')
  }
  const toggleReference = (id: string) => setValue('references', toggled(references, id))
  const canStart = formState.isValid && !!chosen && !create.isPending
  return {
    register,
    type,
    forType,
    chosen,
    references,
    onSubmit,
    chooseType,
    toggleReference,
    setValue,
    canStart,
    create,
  }
}
