// The placeholder Purpose line in methodSkeleton, swapped for what the human wrote.
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import { DEFAULT_TRACKER, type Tracker } from '#core/shared/tracker.ts'
import { allowedTargets, type WorkItemType } from '#core/shared/workItemType.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'
import { methodSkeleton } from '#core/template/templateValidator.ts'

import { useCreateTemplate } from '@/api/hooks/templates/templateHooks'
import { useStartTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { DEFAULT_NAME_PREFIX } from '@/constants/TemplateConstants'
import { useTemplateTrackerChoice } from '@/hooks/templates/useTemplateTrackerChoice'
import { type NewTemplateFormData, newTemplateSchema } from '@/lib/formSchemas/newTemplateSchema'
import { routesPaths } from '@/routes/routes'

/** The placeholder Purpose line in methodSkeleton, swapped for what the human wrote. */
const SKELETON_PURPOSE = 'What this work item is for and who reads it (BA, developer, tester).'

/** A Template built by hand from nothing: one Section and the method skeleton as a nudge. `purpose` is trimmed. */
function blankTemplate(tracker: Tracker, workItemType: WorkItemType, purpose: string): Template {
  const name = `New ${workItemType} Template`
  const method = purpose ? methodSkeleton(name).replace(SKELETON_PURPOSE, purpose) : methodSkeleton(name)
  return {
    id: '',
    tracker,
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
        target: allowedTargets(tracker, workItemType)[0],
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
  const { register, handleSubmit, control, setValue, getFieldState } = useForm<NewTemplateFormData>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { tracker: DEFAULT_TRACKER, workItemType: 'PBI', baseId: '', purpose: '', examples: '' },
  })
  const create = useCreateTemplate()
  const start = useStartTemplateSession()

  const [tracker, type, baseId, purpose, examples] = useWatch({
    control,
    name: ['tracker', 'workItemType', 'baseId', 'purpose', 'examples'],
  })
  const values: NewTemplateFormData = { tracker, workItemType: type, baseId, purpose, examples }
  const forType = templates.filter(
    (template) => templateTracker(template) === tracker && template.workItemType === type,
  )
  const base = forType.find((template) => template.id === values.baseId)

  const { chooseType, chooseTracker } = useTemplateTrackerChoice({ setValue, getFieldState }, type)
  const buildMyself = handleSubmit(({ purpose }) => {
    const template = base ? copyOfBase(base) : blankTemplate(tracker, type, purpose)
    create.mutate(template, { onSuccess: (saved) => void navigate(routesPaths.template(saved.id)) })
  })
  const grill = handleSubmit(({ tracker, workItemType, purpose, examples }) =>
    start.mutate(
      { tracker, workItemType, purpose, examples, ...(base ? { baseTemplateId: base.id } : {}) },
      { onSuccess: (session) => void navigate(routesPaths.templateSession(session.id)) },
    ),
  )
  const choice = { tracker, type, chooseType, chooseTracker }
  return { ...choice, register, values, forType, setValue, buildMyself, grill, create, start }
}
