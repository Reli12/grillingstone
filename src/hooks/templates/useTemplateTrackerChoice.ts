// New Template: which Tracker and type the Template is for. It starts on the Default Tracker once Settings
// arrive, unless the human already picked one, and switching Tracker keeps the type when the other has it too.
import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { Tracker } from '#core/shared/tracker.ts'
import { type WorkItemType, workItemTypes } from '#core/shared/workItemType.ts'

import { useSettings } from '@/api/hooks/projects/projectHooks'
import type { NewTemplateFormData } from '@/lib/formSchemas/newTemplateSchema'

/** The type a new Template starts as: the everyday slice of work in each Tracker. */
const FIRST_TYPE: Record<Tracker, WorkItemType> = { 'azure-devops': 'PBI', jira: 'Story' }

type FormParts = Pick<UseFormReturn<NewTemplateFormData>, 'setValue' | 'getFieldState'>

export function useTemplateTrackerChoice({ setValue, getFieldState }: FormParts, type: WorkItemType) {
  const defaultTracker = useSettings().data?.defaultTracker

  useEffect(() => {
    if (!defaultTracker || getFieldState('tracker').isDirty) return
    setValue('tracker', defaultTracker)
    setValue('workItemType', FIRST_TYPE[defaultTracker])
  }, [defaultTracker, getFieldState, setValue])

  /** Another type means another set of base Templates, so the base pick is cleared. */
  const chooseType = (nextType: WorkItemType) => {
    setValue('workItemType', nextType, { shouldDirty: true })
    setValue('baseId', '')
  }
  const chooseTracker = (nextTracker: Tracker) => {
    setValue('tracker', nextTracker, { shouldDirty: true })
    chooseType(workItemTypes(nextTracker).includes(type) ? type : FIRST_TYPE[nextTracker])
  }
  return { chooseType, chooseTracker }
}
