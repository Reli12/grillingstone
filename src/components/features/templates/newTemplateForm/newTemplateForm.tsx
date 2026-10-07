// One start step for both ways of creating a Template: "Grill it with Claude" (a Template Session) or
// "Build it myself" (an editable Template right away, from nothing or as a copy of a base).
import { useForm, type UseFormRegister, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { WORK_ITEM_TYPES, type WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { methodSkeleton } from '#core/template/templateValidator.ts'

import { useCreateTemplate } from '@/api/hooks/templates/templateHooks'
import { useLiveTemplateSession, useStartTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { Tag } from '@/components/atoms/tag/tag'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { cn } from '@/lib/cn'
import { type NewTemplateFormData, newTemplateSchema, templateSessionSchema } from '@/lib/formSchemas/newTemplateSchema'
import { routesPaths } from '@/routes/routes'

/** The placeholder Purpose line in methodSkeleton, swapped for what the human wrote. */
const SKELETON_PURPOSE = 'What this work item is for and who reads it (BA, developer, tester).'
const DEFAULT_NAME_PREFIX = /^Default / // "Default " at the start of a shipped Template's name
/** The "start from nothing" choice, listed before the type's Templates. */
const NOTHING = { id: '', name: 'Nothing', isDefault: false }

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

function PurposeSection({ register }: Readonly<{ register: UseFormRegister<NewTemplateFormData> }>) {
  return (
    <section>
      <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
        Templates
      </Link>
      <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">
        What is this Template for?
      </h1>
      <p className="mt-2 max-w-lg text-ink-soft">
        Describe the kind of work item and who reads it. Claude grills this into Sections and a writing method — or it
        seeds the Purpose if you build it yourself.
      </p>
      <TextArea
        autoFocus
        minRows={6}
        {...register('purpose')}
        placeholder="Spike PBIs: timeboxed investigations that end in a written recommendation instead of shipped code…"
        aria-label="What the Template is for"
        className="mt-5 font-serif text-[16px] leading-7"
      />

      <div className="mt-6">
        <FieldLabel
          htmlFor="examples"
          hint="Paste one or more real work items written the way you like. Claude learns the house style from them. Leave out client names — Templates are shared."
        >
          Example work items (optional)
        </FieldLabel>
        <TextArea id="examples" minRows={5} {...register('examples')} className="font-serif text-[15px] leading-7" />
      </div>
    </section>
  )
}

interface TypePickerProps {
  type: WorkItemType
  onChoose: (type: WorkItemType) => void
}

function TypePicker({ type, onChoose }: Readonly<TypePickerProps>) {
  return (
    <fieldset>
      <FieldLabel>Work Item Type</FieldLabel>
      <div className="grid grid-cols-3 rounded-lg bg-fog-deep p-1" role="radiogroup">
        {WORK_ITEM_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => onChoose(option)}
            className={cn(
              'h-8 rounded-md text-sm font-medium',
              type === option ? 'bg-sheet text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

interface BasePickerProps {
  /** The chosen type's Templates. */
  templates: Template[]
  baseId: string
  onChoose: (baseId: string) => void
}

function BasePicker({ templates, baseId, onChoose }: Readonly<BasePickerProps>) {
  return (
    <fieldset>
      <FieldLabel hint="Read as a starting point. It is never changed — you always get a new Template.">
        Start from
      </FieldLabel>
      <div className="space-y-1.5">
        {[NOTHING, ...templates].map((option) => (
          <label
            key={option.id || 'nothing'}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm',
              baseId === option.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
            )}
          >
            <input
              type="radio"
              name="base"
              className="accent-claude"
              checked={baseId === option.id}
              onChange={() => onChoose(option.id)}
            />
            <span className="flex-1 font-medium">{option.name}</span>
            {option.isDefault && <Tag>Default</Tag>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface StartActionsProps {
  /** The Template Session already running, if any: only one runs at a time. */
  runningId?: string
  canGrill: boolean
  starting: boolean
  creating: boolean
  onGrill: () => void
  onBuild: () => void
}

function StartActions({ runningId, canGrill, starting, creating, onGrill, onBuild }: Readonly<StartActionsProps>) {
  return (
    <div className="space-y-2">
      {runningId ? (
        <div className="rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-sm">
          A Template Session is already running.{' '}
          <Link to={routesPaths.templateSession(runningId)} className="font-medium text-claude underline">
            Continue it
          </Link>
        </div>
      ) : (
        <Button variant="claude" size="lg" className="w-full" disabled={!canGrill || starting} onClick={onGrill}>
          {starting ? 'Starting…' : 'Grill it with Claude'}
        </Button>
      )}
      <Button variant="outline" size="lg" className="w-full" disabled={creating} onClick={onBuild}>
        Build it myself
      </Button>
      <p className="text-[13px] text-ink-faint">
        {canGrill
          ? 'Claude asks one question at a time and writes nothing until you confirm.'
          : 'Describe what the Template is for to grill it with Claude.'}
      </p>
    </div>
  )
}

/** The form's state, and its two submits: start a Template Session, or create a Template to edit. */
function useNewTemplateForm(templates: Template[]) {
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

interface NewTemplateFormProps {
  templates: Template[]
}

export function NewTemplateForm({ templates }: Readonly<NewTemplateFormProps>) {
  const { data: live } = useLiveTemplateSession()
  const form = useNewTemplateForm(templates)
  const canGrill = templateSessionSchema.safeParse(form.values).success

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]">
        <PurposeSection register={form.register} />

        <aside className="space-y-7 md:pt-12">
          <TypePicker type={form.type} onChoose={form.chooseType} />
          <BasePicker
            templates={form.forType}
            baseId={form.values.baseId}
            onChoose={(baseId) => form.setValue('baseId', baseId)}
          />
          <StartActions
            runningId={live?.session?.id}
            canGrill={canGrill}
            starting={form.start.isPending}
            creating={form.create.isPending}
            onGrill={form.grill}
            onBuild={form.buildMyself}
          />
        </aside>
      </div>
    </div>
  )
}
