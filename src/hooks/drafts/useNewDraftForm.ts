// The list with the id removed if it was there, or added if it was not.
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import type { PastedCopy } from '#core/backlog/backlogCopy.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import { type WorkItemType } from '#core/shared/workItemType.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'

import { useCreateDraft } from '@/api/hooks/drafts/draftHooks'
import { useImageAttachments } from '@/hooks/chat/useImageAttachments'
import { type NewDraftFormData, newDraftSchema } from '@/lib/formSchemas/newDraftSchema'
import { routesPaths } from '@/routes/routes'

/** The list with the id removed if it was there, or added if it was not. */
const toggled = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id]

/** The type a new Draft starts as: the everyday slice of work in each Tracker. */
const FIRST_TYPE: Record<Project['tracker'], WorkItemType> = { 'azure-devops': 'PBI', jira: 'Story' }

/** The Templates of one Tracker and type. */
const templatesFor = (templates: Template[], tracker: Project['tracker'], type: WorkItemType) =>
  templates.filter((template) => templateTracker(template) === tracker && template.workItemType === type)

/**
 * The form's state. Only the Project's Tracker's Templates are offered. The Template shown as chosen is the
 * one picked, else the type's Default, else its first; picking another type clears the pick.
 */
export function useNewDraftForm(project: Project, templates: Template[]) {
  const navigate = useNavigate()
  const { register, handleSubmit, control, setValue, formState } = useForm<NewDraftFormData>({
    resolver: zodResolver(newDraftSchema),
    mode: 'onChange',
    defaultValues: {
      workItemType: FIRST_TYPE[project.tracker],
      templateId: '',
      requirement: '',
      references: [],
      backlogReferences: [],
      newBacklogCopies: [],
    },
  })
  const create = useCreateDraft(project.id)
  // Keyed by Project until the first session exists; a successful start moves the hint and sizes to it.
  const attachments = useImageAttachments(`new-draft:${project.id}`)
  // "Code this session reads" for the first session; read by default (ADR-0016).
  const [readCodeFolders, setReadCodeFolders] = useState(true)

  const [type, templateId, references, backlogReferences, newBacklogCopies] = useWatch({
    control,
    name: ['workItemType', 'templateId', 'references', 'backlogReferences', 'newBacklogCopies'],
  })
  const forType = useMemo(() => templatesFor(templates, project.tracker, type), [templates, type, project.tracker])
  const picked = forType.find((template) => template.id === templateId)
  const chosen = picked ?? forType.find((template) => template.isDefault) ?? forType[0]

  const onSubmit = handleSubmit(({ templateId: _, backlogReferences: picked, newBacklogCopies: pasted, ...rest }) => {
    if (!chosen) return
    const images = attachments.batch()
    // Left out when empty, so a Draft without Backlog References sends the body it always did.
    const backlog = {
      ...(picked.length ? { backlogReferences: picked } : {}),
      ...(pasted.length ? { newBacklogCopies: pasted } : {}),
    }
    // Left out unless switched off, so a session that reads code sends the body it always did.
    const code = readCodeFolders ? {} : { readCodeFolders }
    create.mutate(
      { ...rest, ...backlog, ...code, templateId: chosen.id, images: images.uploads },
      {
        onSuccess: ({ draft, session }) => {
          attachments.markSent(images, session.id)
          void navigate(routesPaths.draft(project.id, draft.id))
        },
      },
    )
  })
  const chooseType = (nextType: WorkItemType) => {
    setValue('workItemType', nextType)
    setValue('templateId', '')
  }
  const toggleReference = (id: string) => setValue('references', toggled(references, id))
  // Setting a Backlog Reference re-checks the requirement, which is optional while one is attached.
  const revalidate = { shouldValidate: true }
  const toggleBacklogReference = (id: string) =>
    setValue('backlogReferences', toggled(backlogReferences, id), revalidate)
  const addBacklogCopy = (pasted: PastedCopy) => setValue('newBacklogCopies', [...newBacklogCopies, pasted], revalidate)
  const removeBacklogCopy = (index: number) =>
    setValue(
      'newBacklogCopies',
      newBacklogCopies.filter((_pasted, at) => at !== index),
      revalidate,
    )
  const hasBacklog = backlogReferences.length + newBacklogCopies.length > 0
  const canStart = formState.isValid && !!chosen && !create.isPending
  return {
    register,
    type,
    forType,
    chosen,
    references,
    backlogReferences,
    newBacklogCopies,
    hasBacklog,
    onSubmit,
    chooseType,
    toggleReference,
    toggleBacklogReference,
    addBacklogCopy,
    removeBacklogCopy,
    setValue,
    canStart,
    create,
    attachments,
    readCodeFolders,
    setReadCodeFolders,
  }
}
