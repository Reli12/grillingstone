// The form, reset whenever the dialog opens. Picking a source clears the body; choosing a Project to
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'

import { startingGlossary, withoutTitle } from '#core/glossary/glossary.ts'
import { DEFAULT_TRACKER, type Tracker } from '#core/shared/tracker.ts'

import { useCreateProject, useSettings } from '@/api/hooks/projects/projectHooks'
import { projectsApi } from '@/api/projectsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { type NewProjectFormData, newProjectSchema } from '@/lib/formSchemas/projectSchema'
import { routesPaths } from '@/routes/routes'
import type { Source } from '@/types/project'

/** Another Project's Glossary without its title, which becomes the new Project's name. */
async function glossaryBodyOf(qc: QueryClient, projectId: string) {
  const doc = await qc.query({
    queryKey: queryKeys.glossary(projectId),
    queryFn: () => projectsApi.getGlossary(projectId),
  })
  return withoutTitle(doc.markdown)
}

/** An empty form on the given Tracker. */
const blankForm = (tracker: Tracker): NewProjectFormData => ({
  name: '',
  tracker,
  source: 'empty',
  copyFrom: '',
  body: '',
})

/**
 * The form, reset whenever the dialog opens. Picking a source clears the body; choosing a Project to
 * copy fetches its Glossary into the body once, after which the two are independent.
 */
export function useCreateProjectForm(open: boolean) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const create = useCreateProject()
  const defaultTracker = useSettings().data?.defaultTracker ?? DEFAULT_TRACKER
  const { register, handleSubmit, control, setValue, reset, formState } = useForm<NewProjectFormData>({
    resolver: zodResolver(newProjectSchema),
    mode: 'onChange',
    defaultValues: blankForm(defaultTracker),
  })
  // Each opening starts afresh, with the Default Tracker as it is in Settings now.
  useEffect(() => {
    if (open) reset(blankForm(defaultTracker))
  }, [open, reset, defaultTracker])

  const [name, tracker, source, copyFrom, body] = useWatch({
    control,
    name: ['name', 'tracker', 'source', 'copyFrom', 'body'],
  })
  const setTracker = (picked: Tracker) => setValue('tracker', picked)
  const setBody = (text: string) => setValue('body', text, { shouldDirty: true })
  const copy = async (projectId: string) => {
    setValue('copyFrom', projectId)
    setBody(await glossaryBodyOf(qc, projectId))
  }
  const pick = (picked: Source) => {
    setValue('source', picked)
    setBody('')
    if (picked === 'copy' && copyFrom) void copy(copyFrom)
  }

  const onSubmit = handleSubmit((values) => {
    const glossary = values.source === 'empty' ? '' : startingGlossary(values.name, values.body)
    // Send a glossary only when there is one to start from.
    const request = { name: values.name, tracker: values.tracker, ...(glossary ? { glossary } : {}) }
    create.mutate(request, { onSuccess: (project) => void navigate(routesPaths.project(project.id)) })
  })

  const canCreate = formState.isValid && !create.isPending
  const trackerChoice = { tracker, defaultTracker, setTracker }
  return { ...trackerChoice, register, name, source, copyFrom, body, setBody, copy, pick, onSubmit, canCreate }
}
