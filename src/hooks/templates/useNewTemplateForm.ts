// The placeholder Purpose line in methodSkeleton, swapped for what the human wrote.
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { type WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { methodSkeleton } from '#core/template/templateValidator.ts'

import { useCreateTemplate } from '@/api/hooks/templates/templateHooks'
import { useStartTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { DEFAULT_NAME_PREFIX } from '@/constants/TemplateConstants'
import { type NewTemplateFormData, newTemplateSchema } from '@/lib/formSchemas/newTemplateSchema'
import { routesPaths } from '@/routes/routes'

/** The placeholder Purpose line in methodSkeleton, swapped for what the human wrote. */
const SKELETON_PURPOSE = 'What this work item is for and who reads it (BA, developer, tester).'

/** A Template built by hand from nothing: one Section and the method skeleton as a nudge. `purpose` is trimmed. */
function blankTemplate(workItemType: WorkItemType, purpose: string): Template {
  const name = `New ${workItemType} Template`
  const method = purpose ? methodSkeleton(name).replace(SKELETON_PURPOSE, purpose) : methodSkeleton(name)
  return {
    id: '',
    workItemType,
    name,
    version: 1,
    isDefault: false,
    sections: [
      {
        key: 'section1',
        heading: 'New Section',
        shape: 'prose',
        locked: false,
        guidance: '',
        target: ADO_FIELDS.description,
      },
    ],
    method,
    iterationLogHeading: `${workItemType} Iteration Log`,
    updatedAt: '',
  }
}

/** A copy of the base to edit: a Default's copy is renamed "My …" and is no longer a Default. */
const copyOfBase = (base: Template): Template => ({
  ...base,
  name: base.name.replace(DEFAULT_NAME_PREFIX, 'My '),
  isDefault: false,
})

/** The form's state, and its two submits: start a Template Session, or create a Template to edit. */
export function useNewTemplateForm(templates: Template[]) {
  const navigate = useNavigate()
  const { register, handleSubmit, control, setValue } = useForm<NewTemplateFormData>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { workItemType: 'PBI', baseId: '', purpose: '', examples: '' },
  })
  const create = useCreateTemplate()
  const start = useStartTemplateSession()

  const [type, baseId, purpose, examples] = useWatch({
    control,
    name: ['workItemType', 'baseId', 'purpose', 'examples'],
  })
  const values: NewTemplateFormData = { workItemType: type, baseId, purpose, examples }
  const forType = templates.filter((template) => template.workItemType === type)
  const base = forType.find((template) => template.id === values.baseId)

  const chooseType = (nextType: WorkItemType) => {
    setValue('workItemType', nextType)
    setValue('baseId', '')
  }
  const buildMyself = handleSubmit(({ purpose }) => {
    const template = base ? copyOfBase(base) : blankTemplate(type, purpose)
    create.mutate(template, { onSuccess: (saved) => void navigate(routesPaths.template(saved.id)) })
  })
  const grill = handleSubmit(({ workItemType, purpose, examples }) =>
    start.mutate(
      { workItemType, purpose, examples, ...(base ? { baseTemplateId: base.id } : {}) },
      { onSuccess: (session) => void navigate(routesPaths.templateSession(session.id)) },
    ),
  )
  return { register, values, type, forType, setValue, chooseType, buildMyself, grill, create, start }
}
