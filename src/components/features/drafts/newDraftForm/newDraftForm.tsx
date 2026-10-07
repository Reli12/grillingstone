import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
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
import { newDraftSchema, type NewDraftFormData } from '@/lib/formSchemas/newDraftSchema'
import { routesPaths } from '@/routes/routes'

interface NewDraftFormProps {
  project: Project
  templates: Template[]
  /** The Project's Drafts; written ones can be referenced. */
  drafts: DraftSummary[]
}

/** Requirement, Work Item Type, Template and References for a new Draft; submitting starts the first session. */
export function NewDraftForm({ project, templates, drafts }: NewDraftFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState } = useForm<NewDraftFormData>({
    resolver: zodResolver(newDraftSchema),
    mode: 'onChange',
    defaultValues: { workItemType: 'PBI', templateId: '', requirement: '', references: [] },
  })

  const create = useCreateDraft(project.id)

  const type = watch('workItemType')
  const templateId = watch('templateId')
  const references = watch('references')
  const forType = useMemo(() => templates.filter((t) => t.workItemType === type), [templates, type])

  const chosen = forType.find((t) => t.id === templateId) ?? forType.find((t) => t.isDefault) ?? forType[0]
  const referable = drafts.filter((d) => d.version > 0)
  const onSubmit = handleSubmit(({ templateId: _, ...rest }) => {
    if (!chosen) return
    create.mutate({ ...rest, templateId: chosen.id }, { onSuccess: ({ draft }) => navigate(routesPaths.draft(project.id, draft.id)) })
  })
  const chooseType = (t: WorkItemType) => {
    setValue('workItemType', t)
    setValue('templateId', '')
  }
  const toggleReference = (id: string) =>
    setValue('references', references.includes(id) ? references.filter((r) => r !== id) : [...references, id])

  return (
    <form className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]" onSubmit={onSubmit}>
      <section>
        <Link to={routesPaths.project(project.id)} className="text-sm text-ink-faint hover:text-ink">
          {project.name}
        </Link>
        <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">What do you want to grill?</h1>
        <p className="mt-2 max-w-lg text-ink-soft">Describe the requirement in your own words — a sentence is enough. Paste the BA’s Feature text or business rules if you have them.</p>
        <TextArea
          autoFocus
          minRows={9}
          {...register('requirement')}
          placeholder="Managers need to archive devices so they stop cluttering dashboards…"
          aria-label="Requirement"
          className="mt-5 font-serif text-[16px] leading-7"
        />

        {referable.length > 0 && (
          <fieldset className="mt-6">
            <FieldLabel hint="Claude may read these Drafts as context. No hierarchy — each Draft stands on its own.">References (optional)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {referable.map((d) => {
                const on = references.includes(d.id)
                return (
                  <label key={d.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', on ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint')}>
                    <input type="checkbox" className="accent-claude" checked={on} onChange={() => toggleReference(d.id)} />
                    <span className="text-ink-faint">{d.workItemType}</span> {d.title}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}
      </section>

      <aside className="space-y-7 md:pt-12">
        <fieldset>
          <FieldLabel>Work Item Type</FieldLabel>
          <div className="grid grid-cols-5 rounded-lg bg-fog-deep p-1" role="radiogroup">
            {WORK_ITEM_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => chooseType(t)}
                className={cn('h-8 rounded-md text-sm font-medium', type === t ? 'bg-sheet text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-faint">{WORK_ITEM_TYPE_HINTS[type]}</p>
        </fieldset>

        <fieldset>
          <FieldLabel hint="Decides the Sections Claude must write and how.">Template</FieldLabel>
          <div className="space-y-1.5">
            {forType.map((t) => (
              <label key={t.id} className={cn('flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm', chosen?.id === t.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint')}>
                <input type="radio" name="template" className="mt-1 accent-claude" checked={chosen?.id === t.id} onChange={() => setValue('templateId', t.id)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {t.name}
                    {t.isDefault && <Tag>Default</Tag>}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-faint">{t.sections.map((s) => s.heading).join(', ')}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Button type="submit" variant="claude" size="lg" className="w-full" disabled={!formState.isValid || !chosen || create.isPending}>
            {create.isPending ? 'Starting…' : 'Start grilling'}
          </Button>
          <p className="mt-2 text-[13px] text-ink-faint">Claude asks one question at a time. Nothing is written until you confirm.</p>
        </div>
      </aside>
    </form>
  )
}
