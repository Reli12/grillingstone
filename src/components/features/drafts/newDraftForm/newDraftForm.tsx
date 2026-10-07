// The New Draft form: the requirement, Work Item Type, Template and References for a Draft.
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import { WORK_ITEM_TYPE_HINTS, WORK_ITEM_TYPES, type WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { useCreateDraft } from '@/api/hooks/drafts/draftHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { Tag } from '@/components/atoms/tag/tag'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { cn } from '@/lib/cn'
import { type NewDraftFormData, newDraftSchema } from '@/lib/formSchemas/newDraftSchema'
import { routesPaths } from '@/routes/routes'

/** The list with the id removed if it was there, or added if it was not. */
const toggled = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id]

interface ReferencePickerProps {
  /** The Project's written Drafts. */
  referable: DraftSummary[]
  references: string[]
  onToggle: (draftId: string) => void
}

function ReferencePicker({ referable, references, onToggle }: Readonly<ReferencePickerProps>) {
  return (
    <fieldset className="mt-6">
      <FieldLabel hint="Claude may read these Drafts as context. No hierarchy — each Draft stands on its own.">
        References (optional)
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {referable.map((draft) => {
          const on = references.includes(draft.id)
          return (
            <label
              key={draft.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                on ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
              )}
            >
              <input type="checkbox" className="accent-claude" checked={on} onChange={() => onToggle(draft.id)} />
              <span className="text-ink-faint">{draft.workItemType}</span> {draft.title}
            </label>
          )
        })}
      </div>
    </fieldset>
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
      <div className="grid grid-cols-5 rounded-lg bg-fog-deep p-1" role="radiogroup">
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
      <p className="mt-2 text-[13px] text-ink-faint">{WORK_ITEM_TYPE_HINTS[type]}</p>
    </fieldset>
  )
}

interface TemplatePickerProps {
  /** The Templates of the chosen Work Item Type. */
  templates: Template[]
  chosenId?: string
  onChoose: (templateId: string) => void
}

function TemplatePicker({ templates, chosenId, onChoose }: Readonly<TemplatePickerProps>) {
  return (
    <fieldset>
      <FieldLabel hint="Decides the Sections Claude must write and how.">Template</FieldLabel>
      <div className="space-y-1.5">
        {templates.map((template) => (
          <label
            key={template.id}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm',
              chosenId === template.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint',
            )}
          >
            <input
              type="radio"
              name="template"
              className="mt-1 accent-claude"
              checked={chosenId === template.id}
              onChange={() => onChoose(template.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">
                {template.name}
                {template.isDefault && <Tag>Default</Tag>}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-faint">
                {template.sections.map((section) => section.heading).join(', ')}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function StartButton({ disabled, starting }: Readonly<{ disabled: boolean; starting: boolean }>) {
  return (
    <div>
      <Button type="submit" variant="claude" size="lg" className="w-full" disabled={disabled}>
        {starting ? 'Starting…' : 'Start grilling'}
      </Button>
      <p className="mt-2 text-[13px] text-ink-faint">
        Claude asks one question at a time. Nothing is written until you confirm.
      </p>
    </div>
  )
}

/**
 * The form's state. The Template shown as chosen is the one picked, else the type's Default, else
 * its first; picking another type clears the pick.
 */
function useNewDraftForm(project: Project, templates: Template[]) {
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

interface NewDraftFormProps {
  project: Project
  templates: Template[]
  /** The Project's Drafts; written ones can be referenced. */
  drafts: DraftSummary[]
}

/** Requirement, Work Item Type, Template and References for a new Draft; submitting starts the first session. */
export function NewDraftForm({ project, templates, drafts }: Readonly<NewDraftFormProps>) {
  const form = useNewDraftForm(project, templates)
  const referable = drafts.filter((draft) => draft.version > 0)

  return (
    <form className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]" onSubmit={form.onSubmit}>
      <section>
        <Link to={routesPaths.project(project.id)} className="text-sm text-ink-faint hover:text-ink">
          {project.name}
        </Link>
        <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">
          What do you want to grill?
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Describe the requirement in your own words — a sentence is enough. Paste the BA’s Feature text or business
          rules if you have them.
        </p>
        <TextArea
          autoFocus
          minRows={9}
          {...form.register('requirement')}
          placeholder="Managers need to archive devices so they stop cluttering dashboards…"
          aria-label="Requirement"
          className="mt-5 font-serif text-[16px] leading-7"
        />
        {referable.length > 0 && (
          <ReferencePicker referable={referable} references={form.references} onToggle={form.toggleReference} />
        )}
      </section>

      <aside className="space-y-7 md:pt-12">
        <TypePicker type={form.type} onChoose={form.chooseType} />
        <TemplatePicker
          templates={form.forType}
          chosenId={form.chosen?.id}
          onChoose={(templateId) => form.setValue('templateId', templateId)}
        />
        <StartButton disabled={!form.canStart} starting={form.create.isPending} />
      </aside>
    </form>
  )
}
