// One start step for both ways of creating a Template: "Grill it with Claude" (a Template Session) or
// "Build it myself" (an editable Template right away, from nothing or as a copy of a base).
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
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
import { newTemplateSchema, templateSessionSchema, type NewTemplateFormData } from '@/lib/formSchemas/newTemplateSchema'
import { routesPaths } from '@/routes/routes'

/** A Template built by hand from nothing: one Section and the method skeleton as a nudge. `purpose` is trimmed. */
function blankTemplate(workItemType: WorkItemType, purpose: string): Template {
  const name = `New ${workItemType} Template`
  const method = purpose
    ? methodSkeleton(name).replace('What this work item is for and who reads it (BA, developer, tester).', purpose)
    : methodSkeleton(name)
  return {
    id: '',
    workItemType,
    name,
    version: 1,
    isDefault: false,
    sections: [{ key: 'section1', heading: 'New Section', shape: 'prose', locked: false, guidance: '', target: ADO_FIELDS.description }],
    method,
    iterationLogHeading: `${workItemType} Iteration Log`,
    updatedAt: '',
  }
}

interface NewTemplateFormProps {
  templates: Template[]
}

export function NewTemplateForm({ templates }: NewTemplateFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue } = useForm<NewTemplateFormData>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { workItemType: 'PBI', baseId: '', purpose: '', examples: '' },
  })

  const { data: live } = useLiveTemplateSession()
  const create = useCreateTemplate()
  const start = useStartTemplateSession()

  const values = watch()
  const type = values.workItemType
  const forType = templates.filter((t) => t.workItemType === type)
  const base = forType.find((t) => t.id === values.baseId)
  const running = live?.session
  const canGrill = templateSessionSchema.safeParse(values).success

  const chooseType = (t: WorkItemType) => {
    setValue('workItemType', t)
    setValue('baseId', '')
  }
  const buildMyself = handleSubmit(({ purpose }) => {
    const t = base ? { ...base, name: `${base.name.replace(/^Default /, 'My ')}`, isDefault: false } : blankTemplate(type, purpose)
    create.mutate(t, { onSuccess: (saved) => navigate(routesPaths.template(saved.id)) })
  })
  const grill = handleSubmit(({ workItemType, purpose, examples }) =>
    start.mutate(
      { workItemType, purpose, examples, ...(base ? { baseTemplateId: base.id } : {}) },
      { onSuccess: (s) => navigate(routesPaths.templateSession(s.id)) },
    ),
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]">
        <section>
          <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
            Templates
          </Link>
          <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">What is this Template for?</h1>
          <p className="mt-2 max-w-lg text-ink-soft">Describe the kind of work item and who reads it. Claude grills this into Sections and a writing method — or it seeds the Purpose if you build it yourself.</p>
          <TextArea
            autoFocus
            minRows={6}
            {...register('purpose')}
            placeholder="Spike PBIs: timeboxed investigations that end in a written recommendation instead of shipped code…"
            aria-label="What the Template is for"
            className="mt-5 font-serif text-[16px] leading-7"
          />

          <div className="mt-6">
            <FieldLabel htmlFor="examples" hint="Paste one or more real work items written the way you like. Claude learns the house style from them. Leave out client names — Templates are shared.">
              Example work items (optional)
            </FieldLabel>
            <TextArea id="examples" minRows={5} {...register('examples')} className="font-serif text-[15px] leading-7" />
          </div>
        </section>

        <aside className="space-y-7 md:pt-12">
          <fieldset>
            <FieldLabel>Work Item Type</FieldLabel>
            <div className="grid grid-cols-3 rounded-lg bg-fog-deep p-1" role="radiogroup">
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
          </fieldset>

          <fieldset>
            <FieldLabel hint="Read as a starting point. It is never changed — you always get a new Template.">Start from</FieldLabel>
            <div className="space-y-1.5">
              {[{ id: '', name: 'Nothing', isDefault: false }, ...forType].map((t) => (
                <label key={t.id || 'nothing'} className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm', values.baseId === t.id ? 'border-claude bg-claude-wash' : 'border-line bg-sheet hover:border-ink-faint')}>
                  <input type="radio" name="base" className="accent-claude" checked={values.baseId === t.id} onChange={() => setValue('baseId', t.id)} />
                  <span className="flex-1 font-medium">{t.name}</span>
                  {t.isDefault && <Tag>Default</Tag>}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            {running ? (
              <div className="rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-sm">
                A Template Session is already running.{' '}
                <Link to={routesPaths.templateSession(running.id)} className="font-medium text-claude underline">
                  Continue it
                </Link>
              </div>
            ) : (
              <Button variant="claude" size="lg" className="w-full" disabled={!canGrill || start.isPending} onClick={grill}>
                {start.isPending ? 'Starting…' : 'Grill it with Claude'}
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" disabled={create.isPending} onClick={buildMyself}>
              Build it myself
            </Button>
            <p className="text-[13px] text-ink-faint">
              {canGrill ? 'Claude asks one question at a time and writes nothing until you confirm.' : 'Describe what the Template is for to grill it with Claude.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
