// The Template editor: name, Iteration Log, the ordered Sections and the writing method. Saving
// writes the next version; Defaults are read-only and offer a copy instead.
import { type ChangeEvent, type ReactNode, useState } from 'react'
import { type FieldErrors, useFieldArray, useForm, type UseFormRegister, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ADO_FIELD_LABELS, type SectionTarget } from '#core/shared/adoFields.ts'
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
import { type TemplateFormData, templateSchema } from '@/lib/formSchemas/templateSchema'
import { routesPaths } from '@/routes/routes'

const NON_ALPHANUMERIC_RUN = /[^A-Za-z0-9 ]+/g // punctuation and symbols, which a key can't hold
const WHITESPACE_RUN = /\s+/ // the gaps between words
const PLACEHOLDER_KEY = /^section\d*$/ // the "section", "section3"… keys a new Section starts with
const DEFAULT_NAME_PREFIX = /^Default / // "Default " at the start of a shipped Template's name

const inputCls =
  'h-8 rounded-md border border-line bg-sheet px-2 text-sm focus:border-claude focus:outline-none disabled:bg-fog disabled:text-ink-soft'

type SectionFormData = TemplateFormData['sections'][number]

const toForm = (template: Template): TemplateFormData => ({
  name: template.name,
  workItemType: template.workItemType,
  iterationLogHeading: template.iterationLogHeading,
  iterationLogTarget: template.iterationLogTarget ?? defaultIterationLogTarget(template.workItemType),
  method: template.method,
  sections: template.sections.map((section) => ({
    key: section.key,
    heading: section.heading,
    shape: section.shape,
    locked: section.locked,
    guidance: section.guidance,
    target: section.target,
    gherkin: section.entryFormat === 'gherkin',
  })),
})

/** The form's Sections back into Template Sections; the Gherkin flag only means something for Entries. */
const fromForm = (base: Template, form: TemplateFormData): Template => ({
  ...base,
  name: form.name,
  iterationLogHeading: form.iterationLogHeading,
  iterationLogTarget: form.iterationLogTarget,
  method: form.method,
  sections: form.sections.map(({ gherkin, ...section }) => ({
    ...section,
    ...(gherkin && section.shape === 'entries' ? { entryFormat: 'gherkin' as const } : {}),
  })),
})

const capitalised = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase()

/** A camelCase key from a heading: "Acceptance criteria!" becomes "acceptanceCriteria". */
const keyFrom = (heading: string) =>
  heading
    .replace(NON_ALPHANUMERIC_RUN, ' ')
    .trim()
    .split(WHITESPACE_RUN)
    .map((word, i) => (i === 0 ? word.toLowerCase() : capitalised(word)))
    .join('')

const newSection = (position: number, target: SectionTarget): SectionFormData => ({
  key: `section${position}`,
  heading: '',
  shape: 'prose',
  locked: false,
  guidance: '',
  target,
  gherkin: false,
})

function TemplateHeader({ template }: Readonly<{ template: Template }>) {
  const { origin } = template
  return (
    <>
      <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
        Templates
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-[28px] leading-tight font-semibold tracking-tight">{template.name}</h1>
        <Tag>
          {template.workItemType}, v{template.version}
        </Tag>
        {template.isDefault && <Tag tone="ink">Default, read-only</Tag>}
      </div>
      {origin && (
        <p className="mt-2 text-sm text-ink-soft">
          Made in a Template Session on{' '}
          {new Date(origin.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.{' '}
          <Link to={routesPaths.templateSession(origin.sessionId)} className="text-claude underline">
            Read the transcript
          </Link>
        </p>
      )}
    </>
  )
}

/** Shown on a Default: it can't be edited, but a "My …" copy can. */
function DuplicateBanner({ template }: Readonly<{ template: Template }>) {
  const navigate = useNavigate()
  const duplicate = useCreateTemplate()
  const onDuplicate = () =>
    duplicate.mutate(
      { ...template, name: template.name.replace(DEFAULT_NAME_PREFIX, 'My ') },
      { onSuccess: (copy) => void navigate(routesPaths.template(copy.id)) },
    )
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-sheet px-4 py-3 text-sm">
      <span className="flex-1 text-ink-soft">
        Default Templates can’t be changed. Duplicate it to make your own version.
      </span>
      <Button variant="ink" size="sm" onClick={onDuplicate}>
        <Copy size={14} /> Duplicate to customise
      </Button>
    </div>
  )
}

interface FormPartProps {
  register: UseFormRegister<TemplateFormData>
  errors: FieldErrors<TemplateFormData>
  readOnly: boolean
}

interface GeneralFieldsProps extends FormPartProps {
  targetOptions: ReactNode
}

function GeneralFields({ register, errors, readOnly, targetOptions }: Readonly<GeneralFieldsProps>) {
  return (
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
  )
}

interface RowButtonsProps {
  index: number
  count: number
  readOnly: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

/** Move up, move down and remove; a Template keeps at least one Section. */
function RowButtons({ index, count, readOnly, onMove, onRemove }: Readonly<RowButtonsProps>) {
  return (
    <span className="flex items-center gap-0.5">
      <Button
        size="sm"
        variant="quiet"
        aria-label="Move up"
        disabled={readOnly || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        size="sm"
        variant="quiet"
        aria-label="Move down"
        disabled={readOnly || index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown size={14} />
      </Button>
      <Button
        size="sm"
        variant="danger"
        aria-label="Remove Section"
        disabled={readOnly || count === 1}
        onClick={() => onRemove(index)}
      >
        <Trash2 size={14} />
      </Button>
    </span>
  )
}

/** The Section's key, shape, Locked flag, and for Entries whether they are written as Given / When / Then. */
function SectionOptions({
  index,
  register,
  isEntries,
}: Readonly<{ index: number; register: UseFormRegister<TemplateFormData>; isEntries: boolean }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm sm:col-span-3">
      <label className="flex items-center gap-1.5">
        <span className="text-ink-faint">Key</span>
        <input
          {...register(`sections.${index}.key`)}
          aria-label="Key"
          className={cn(inputCls, 'h-7 w-40 font-mono text-[13px]')}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-ink-faint">Shape</span>
        <select {...register(`sections.${index}.shape`)} className={cn(inputCls, 'h-7')}>
          <option value="prose">Prose</option>
          <option value="entries">Entries</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="accent-claude" {...register(`sections.${index}.locked`)} /> Locked
      </label>
      {isEntries && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-claude" {...register(`sections.${index}.gherkin`)} /> Entries are
          Given / When / Then
        </label>
      )}
    </div>
  )
}

interface HeadingFieldProps {
  index: number
  register: UseFormRegister<TemplateFormData>
  error?: string
  onChange: (heading: string) => void
}

function HeadingField({ index, register, error, onChange }: Readonly<HeadingFieldProps>) {
  return (
    <div>
      <input
        {...register(`sections.${index}.heading`, {
          onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
        })}
        aria-label="Heading"
        placeholder="Heading"
        className={cn(inputCls, 'w-full font-serif font-semibold')}
      />
      <FieldError message={error} />
    </div>
  )
}

interface SectionRowProps extends FormPartProps, Omit<RowButtonsProps, 'readOnly'> {
  section?: SectionFormData
  targetOptions: ReactNode
  onHeadingChange: (heading: string) => void
}

function SectionRow({
  index,
  count,
  section,
  register,
  errors,
  readOnly,
  targetOptions,
  onHeadingChange,
  onMove,
  onRemove,
}: Readonly<SectionRowProps>) {
  const sectionErrors = errors.sections?.[index]
  return (
    <li className="rounded-lg border border-line bg-sheet p-3">
      <fieldset disabled={readOnly} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
        <HeadingField
          index={index}
          register={register}
          error={sectionErrors?.heading?.message}
          onChange={onHeadingChange}
        />
        <select {...register(`sections.${index}.target`)} aria-label="Azure DevOps field" className={inputCls}>
          {targetOptions}
        </select>
        <RowButtons index={index} count={count} readOnly={readOnly} onMove={onMove} onRemove={onRemove} />
        <input
          {...register(`sections.${index}.guidance`)}
          aria-label="Guidance"
          placeholder="One line of guidance for Claude and for you"
          className={cn(inputCls, 'sm:col-span-3')}
        />
        <SectionOptions index={index} register={register} isEntries={section?.shape === 'entries'} />
        <FieldError message={sectionErrors?.key?.message} />
      </fieldset>
    </li>
  )
}

interface MethodFieldProps {
  register: UseFormRegister<TemplateFormData>
  readOnly: boolean
  error?: string
}

function MethodField({ register, readOnly, error }: Readonly<MethodFieldProps>) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold">Writing method</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The instructions Claude follows for content, in markdown. They travel with the Template when you share it.
      </p>
      <textarea
        {...register('method')}
        disabled={readOnly}
        rows={22}
        aria-label="Writing method"
        className="mt-3 w-full rounded-md border border-line bg-sheet px-4 py-3 font-mono text-[13px] leading-6 focus:border-claude focus:outline-none disabled:bg-fog/60 disabled:text-ink-soft"
      />
      <FieldError message={error} />
    </section>
  )
}

interface SaveBarProps {
  nextVersion: number
  dirty: boolean
  saving: boolean
  onDiscard: () => void
  onDelete: () => void
}

function SaveBar({ nextVersion, dirty, saving, onDiscard, onDelete }: Readonly<SaveBarProps>) {
  return (
    <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-line bg-fog/95 py-3 backdrop-blur">
      <Button type="submit" variant="ink" disabled={!dirty || saving}>
        Save as v{nextVersion}
      </Button>
      {dirty && (
        <Button variant="quiet" onClick={onDiscard}>
          Discard changes
        </Button>
      )}
      <span className="ml-auto" />
      <Button variant="danger" onClick={onDelete}>
        <Trash2 size={14} /> Delete Template
      </Button>
    </div>
  )
}

interface DeleteTemplateDialogProps {
  template: Template
  open: boolean
  onClose: () => void
}

function DeleteTemplateDialog({ template, open, onClose }: Readonly<DeleteTemplateDialogProps>) {
  const navigate = useNavigate()
  const remove = useDeleteTemplate()
  const onDelete = () => remove.mutate(template.id, { onSuccess: () => void navigate(routesPaths.templates) })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${template.name}”?`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete Template
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">Drafts already written in it keep their own copy and stay valid.</p>
    </Dialog>
  )
}

/** The editor's form: its fields, the Sections array, and save (which resets to the saved version). */
function useTemplateForm(template: Template) {
  const update = useUpdateTemplate()
  const form = useForm<TemplateFormData>({ resolver: zodResolver(templateSchema), defaultValues: toForm(template) })
  const sectionArray = useFieldArray({ control: form.control, name: 'sections' })
  const sections = useWatch({ control: form.control, name: 'sections' })

  const onSave = form.handleSubmit((values) =>
    update.mutate(fromForm(template, values), {
      onSuccess: (saved) => {
        form.reset(toForm(saved))
        toast.success(`Saved as v${saved.version}. New Drafts use it; existing Drafts can upgrade.`)
      },
    }),
  )

  // A new Section's key follows its heading until it has been saved under a real name.
  const followHeading = (index: number, heading: string) => {
    const key = sections[index]?.key
    const unsaved = !key || PLACEHOLDER_KEY.test(key) || !template.sections.some((saved) => saved.key === key)
    if (unsaved) form.setValue(`sections.${index}.key`, keyFrom(heading) || 'section')
  }
  return { form, sectionArray, sections, onSave, saving: update.isPending, followHeading }
}

interface SectionsEditorProps extends FormPartProps {
  editor: ReturnType<typeof useTemplateForm>
  targetOptions: ReactNode
  /** What a new Section targets until the human picks another field. */
  firstTarget: SectionTarget
}

/** The ordered Sections, each editable, movable and removable, plus "Add Section". */
function SectionsEditor({ editor, targetOptions, firstTarget, ...formPart }: Readonly<SectionsEditorProps>) {
  const { sections, followHeading } = editor
  const { fields, append, remove, move } = editor.sectionArray
  const { errors, readOnly } = formPart
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold">Sections</h2>
      <p className="mt-1 text-sm text-ink-soft">
        In this order Claude must write them — every one, with “N/A — reason” when empty. Locked Sections can never be
        discarded or left empty.
      </p>
      <FieldError message={errors.sections?.message ?? errors.sections?.root?.message} />
      <ol className="mt-4 space-y-2">
        {fields.map((field, i) => (
          <SectionRow
            key={field.id}
            {...formPart}
            index={i}
            count={fields.length}
            section={sections[i]}
            targetOptions={targetOptions}
            onHeadingChange={(heading) => followHeading(i, heading)}
            onMove={move}
            onRemove={remove}
          />
        ))}
      </ol>
      {!readOnly && (
        <Button
          size="sm"
          variant="quiet"
          className="mt-2"
          onClick={() => append(newSection(fields.length + 1, firstTarget))}
        >
          <Plus size={14} /> Add Section
        </Button>
      )}
    </section>
  )
}

interface TemplateEditorProps {
  template: Template
}

/** Edits one Template; Defaults are read-only and offer a copy instead. Saving bumps the version. */
export function TemplateEditor({ template }: Readonly<TemplateEditorProps>) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editor = useTemplateForm(template)
  const { form, onSave, saving } = editor
  const { register, formState, reset } = form
  const errors = formState.errors

  const readOnly = template.isDefault
  const targets = allowedTargets(template.workItemType)
  const targetOptions = targets.map((target) => (
    <option key={target} value={target}>
      → {ADO_FIELD_LABELS[target]}
    </option>
  ))
  const formPart = { register, errors, readOnly }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-4xl px-4 py-10">
      <TemplateHeader template={template} />
      {readOnly && <DuplicateBanner template={template} />}
      <GeneralFields {...formPart} targetOptions={targetOptions} />

      <SectionsEditor {...formPart} editor={editor} targetOptions={targetOptions} firstTarget={targets[0]} />

      <MethodField register={register} readOnly={readOnly} error={errors.method?.message} />

      {!readOnly && (
        <SaveBar
          nextVersion={template.version + 1}
          dirty={formState.isDirty}
          saving={saving}
          onDiscard={() => reset(toForm(template))}
          onDelete={() => setConfirmDelete(true)}
        />
      )}

      <DeleteTemplateDialog template={template} open={confirmDelete} onClose={() => setConfirmDelete(false)} />
    </form>
  )
}
