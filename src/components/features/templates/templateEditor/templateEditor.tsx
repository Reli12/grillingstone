import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'
import { allowedTargets, defaultIterationLogTarget } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { Tag } from '@/components/atoms/tag/tag'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { cn } from '@/lib/cn'
import { templateSchema, type TemplateFormData } from '@/lib/formSchemas/templateSchema'
import { routesPaths } from '@/routes/routes'

const toForm = (t: Template): TemplateFormData => ({
  name: t.name,
  workItemType: t.workItemType,
  iterationLogHeading: t.iterationLogHeading,
  iterationLogTarget: t.iterationLogTarget ?? defaultIterationLogTarget(t.workItemType),
  method: t.method,
  sections: t.sections.map((s) => ({
    key: s.key,
    heading: s.heading,
    shape: s.shape,
    locked: s.locked,
    guidance: s.guidance,
    target: s.target,
    gherkin: s.entryFormat === 'gherkin',
  })),
})

const fromForm = (base: Template, f: TemplateFormData): Template => ({
  ...base,
  name: f.name,
  iterationLogHeading: f.iterationLogHeading,
  iterationLogTarget: f.iterationLogTarget,
  method: f.method,
  sections: f.sections.map(({ gherkin, ...s }) => ({ ...s, ...(gherkin && s.shape === 'entries' ? { entryFormat: 'gherkin' as const } : {}) })),
})

const keyFrom = (heading: string) =>
  heading
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')

const inputCls = 'h-8 rounded-md border border-line bg-sheet px-2 text-sm focus:border-claude focus:outline-none disabled:bg-fog disabled:text-ink-soft'

interface TemplateEditorProps {
  template: Template
}

/** Edits one Template; Defaults are read-only and offer a copy instead. Saving bumps the version. */
export function TemplateEditor({ template }: TemplateEditorProps) {
  const navigate = useNavigate()

  const [confirmDelete, setConfirmDelete] = useState(false)

  const update = useUpdateTemplate()
  const duplicate = useCreateTemplate()
  const remove = useDeleteTemplate()

  const readOnly = template.isDefault
  const targets = allowedTargets(template.workItemType)
  const targetOptions = targets.map((t) => (
    <option key={t} value={t}>
      → {ADO_FIELD_LABELS[t]}
    </option>
  ))

  const { register, control, handleSubmit, watch, setValue, formState, reset } = useForm<TemplateFormData>({ resolver: zodResolver(templateSchema), defaultValues: toForm(template) })
  const { fields, append, remove: removeSection, move } = useFieldArray({ control, name: 'sections' })
  const sections = watch('sections')
  const errors = formState.errors

  const onSave = handleSubmit((f) =>
    update.mutate(fromForm(template, f), {
      onSuccess: (saved) => {
        reset(toForm(saved))
        toast.success(`Saved as v${saved.version}. New Drafts use it; existing Drafts can upgrade.`)
      },
    }),
  )

  return (
    <form onSubmit={onSave} className="mx-auto max-w-4xl px-4 py-10">
      <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
        Templates
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-[28px] leading-tight font-semibold tracking-tight">{template.name}</h1>
        <Tag>
          {template.workItemType}, v{template.version}
        </Tag>
        {readOnly && <Tag tone="ink">Default, read-only</Tag>}
      </div>
      {template.origin && (
        <p className="mt-2 text-sm text-ink-soft">
          Made in a Template Session on {new Date(template.origin.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.{' '}
          <Link to={routesPaths.templateSession(template.origin.sessionId)} className="text-claude underline">
            Read the transcript
          </Link>
        </p>
      )}
      {readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-sheet px-4 py-3 text-sm">
          <span className="flex-1 text-ink-soft">Default Templates can’t be changed. Duplicate it to make your own version.</span>
          <Button
            variant="ink"
            size="sm"
            onClick={() => duplicate.mutate({ ...template, name: template.name.replace(/^Default /, 'My ') }, { onSuccess: (t) => navigate(routesPaths.template(t.id)) })}
          >
            <Copy size={14} /> Duplicate to customise
          </Button>
        </div>
      )}

      <fieldset disabled={readOnly} className="mt-8 grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <TextInput id="name" {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="log">Iteration Log heading</FieldLabel>
          <TextInput id="log" {...register('iterationLogHeading')} />
          <FieldError message={errors.iterationLogHeading?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="logTarget">Iteration Log field</FieldLabel>
          <select id="logTarget" {...register('iterationLogTarget')} className={cn(inputCls, 'w-full')}>
            {targetOptions}
          </select>
          <FieldError message={errors.iterationLogTarget?.message} />
        </div>
      </fieldset>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">Sections</h2>
        <p className="mt-1 text-sm text-ink-soft">In this order Claude must write them — every one, with “N/A — reason” when empty. Locked Sections can never be discarded or left empty.</p>
        <FieldError message={errors.sections?.message ?? errors.sections?.root?.message} />
        <ol className="mt-4 space-y-2">
          {fields.map((f, i) => {
            const s = sections[i]
            return (
              <li key={f.id} className="rounded-lg border border-line bg-sheet p-3">
                <fieldset disabled={readOnly} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                  <div>
                    <input
                      {...register(`sections.${i}.heading`, {
                        onChange: (e) => {
                          // A new Section's key follows its heading until it has been saved under a real name.
                          const placeholder = !s?.key || /^section\d*$/.test(s.key) || !template.sections.some((t) => t.key === s.key)
                          if (placeholder) setValue(`sections.${i}.key`, keyFrom(e.target.value) || 'section')
                        },
                      })}
                      aria-label="Heading"
                      placeholder="Heading"
                      className={cn(inputCls, 'w-full font-serif font-semibold')}
                    />
                    <FieldError message={errors.sections?.[i]?.heading?.message} />
                  </div>
                  <select {...register(`sections.${i}.target`)} aria-label="Azure DevOps field" className={inputCls}>
                    {targetOptions}
                  </select>
                  <span className="flex items-center gap-0.5">
                    <Button size="sm" variant="quiet" aria-label="Move up" disabled={readOnly || i === 0} onClick={() => move(i, i - 1)}>
                      <ArrowUp size={14} />
                    </Button>
                    <Button size="sm" variant="quiet" aria-label="Move down" disabled={readOnly || i === fields.length - 1} onClick={() => move(i, i + 1)}>
                      <ArrowDown size={14} />
                    </Button>
                    <Button size="sm" variant="danger" aria-label="Remove Section" disabled={readOnly || fields.length === 1} onClick={() => removeSection(i)}>
                      <Trash2 size={14} />
                    </Button>
                  </span>
                  <input {...register(`sections.${i}.guidance`)} aria-label="Guidance" placeholder="One line of guidance for Claude and for you" className={cn(inputCls, 'sm:col-span-3')} />
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm sm:col-span-3">
                    <label className="flex items-center gap-1.5">
                      <span className="text-ink-faint">Key</span>
                      <input {...register(`sections.${i}.key`)} aria-label="Key" className={cn(inputCls, 'h-7 w-40 font-mono text-[13px]')} />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-ink-faint">Shape</span>
                      <select {...register(`sections.${i}.shape`)} className={cn(inputCls, 'h-7')}>
                        <option value="prose">Prose</option>
                        <option value="entries">Entries</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" className="accent-claude" {...register(`sections.${i}.locked`)} /> Locked
                    </label>
                    {s?.shape === 'entries' && (
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" className="accent-claude" {...register(`sections.${i}.gherkin`)} /> Entries are Given / When / Then
                      </label>
                    )}
                  </div>
                  <FieldError message={errors.sections?.[i]?.key?.message} />
                </fieldset>
              </li>
            )
          })}
        </ol>
        {!readOnly && (
          <Button
            size="sm"
            variant="quiet"
            className="mt-2"
            onClick={() => append({ key: `section${fields.length + 1}`, heading: '', shape: 'prose', locked: false, guidance: '', target: targets[0], gherkin: false })}
          >
            <Plus size={14} /> Add Section
          </Button>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">Writing method</h2>
        <p className="mt-1 text-sm text-ink-soft">The instructions Claude follows for content, in markdown. They travel with the Template when you share it.</p>
        <textarea
          {...register('method')}
          disabled={readOnly}
          rows={22}
          aria-label="Writing method"
          className="mt-3 w-full rounded-md border border-line bg-sheet px-4 py-3 font-mono text-[13px] leading-6 focus:border-claude focus:outline-none disabled:bg-fog/60 disabled:text-ink-soft"
        />
        <FieldError message={errors.method?.message} />
      </section>

      {!readOnly && (
        <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-line bg-fog/95 py-3 backdrop-blur">
          <Button type="submit" variant="ink" disabled={!formState.isDirty || update.isPending}>
            Save as v{template.version + 1}
          </Button>
          {formState.isDirty && (
            <Button variant="quiet" onClick={() => reset(toForm(template))}>
              Discard changes
            </Button>
          )}
          <span className="ml-auto" />
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete Template
          </Button>
        </div>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${template.name}”?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => remove.mutate(template.id, { onSuccess: () => navigate(routesPaths.templates) })}>
              Delete Template
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">Drafts already written in it keep their own copy and stay valid.</p>
      </Dialog>
    </form>
  )
}
