// The form, reset whenever the dialog opens. Picking a source clears the body; choosing a Project to
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'

import { startingGlossary, withoutTitle } from '#core/glossary/glossary.ts'

import { useCreateProject } from '@/api/hooks/projects/projectHooks'
import { projectsApi } from '@/api/projectsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { type NewProjectFormData, newProjectSchema } from '@/lib/formSchemas/projectSchema'
import { routesPaths } from '@/routes/routes'
import type { Source } from '@/types/project'

/**
 * The form, reset whenever the dialog opens. Picking a source clears the body; choosing a Project to
 * copy fetches its Glossary into the body once, after which the two are independent.
 */
export function useCreateProjectForm(open: boolean) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const create = useCreateProject()
  const { register, handleSubmit, control, setValue, reset, formState } = useForm<NewProjectFormData>({
    resolver: zodResolver(newProjectSchema),
    mode: 'onChange',
    defaultValues: { name: '', source: 'empty', copyFrom: '', body: '' },
  })
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const [name, source, copyFrom, body] = useWatch({ control, name: ['name', 'source', 'copyFrom', 'body'] })

  const setBody = (text: string) => setValue('body', text, { shouldDirty: true })
  const copy = async (projectId: string) => {
    setValue('copyFrom', projectId)
    const doc = await qc.query({
      queryKey: queryKeys.glossary(projectId),
      queryFn: () => projectsApi.getGlossary(projectId),
    })
    setBody(withoutTitle(doc.markdown))
  }
  const pick = (picked: Source) => {
    setValue('source', picked)
    setBody('')
    if (picked === 'copy' && copyFrom) void copy(copyFrom)
  }

  const onSubmit = handleSubmit((values) => {
    const glossary = values.source === 'empty' ? '' : startingGlossary(values.name, values.body)
    // Send a glossary only when there is one to start from.
    const request = glossary ? { name: values.name, glossary } : { name: values.name }
    create.mutate(request, { onSuccess: (project) => void navigate(routesPaths.project(project.id)) })
  })

  const canCreate = formState.isValid && !create.isPending
  return { register, name, source, copyFrom, body, setBody, copy, pick, onSubmit, canCreate }
}
