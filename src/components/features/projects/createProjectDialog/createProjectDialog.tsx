// The New Project dialog: a name, and where the Project's Glossary starts from.
import { type ChangeEvent, type ReactNode, useEffect } from 'react'
import { useForm, type UseFormRegister, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpenText, ClipboardPaste, Copy, FilePlus2, Upload } from 'lucide-react'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'
import { type GlossaryTerm, parseGlossary, startingGlossary, withoutTitle } from '#core/glossary/glossary.ts'

import { useCreateProject, useProjects } from '@/api/hooks/projects/projectHooks'
import { projectsApi } from '@/api/projectsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { cn } from '@/lib/cn'
import { type NewProjectFormData, newProjectSchema } from '@/lib/formSchemas/projectSchema'
import { routesPaths } from '@/routes/routes'

type Source = NewProjectFormData['source']

/** Stands in for the title while the name field is still empty. */
const NAME_PLACEHOLDER = 'Project name'
/** How many recognised terms the preview names before it trails off with "…". */
const NAMED_TERMS = 6
const PASTE_PLACEHOLDER = 'Paste your glossary here, in any format. A # Title line is replaced by the Project name.'

interface SourceChoiceProps {
  value: Source
  current: Source
  icon: ReactNode
  label: string
  hint: string
  onPick: (source: Source) => void
}

function SourceChoice({ value, current, icon, label, hint, onPick }: Readonly<SourceChoiceProps>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-2.5 rounded-md border p-2.5',
        current === value ? 'border-claude bg-claude-wash' : 'border-line hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        checked={current === value}
        onChange={() => onPick(value)}
        className="mt-1 accent-(--color-claude)"
        aria-label={`${label}. ${hint}`}
      />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {label}
        </span>
        <span className="block text-[13px] text-ink-faint">{hint}</span>
      </span>
    </label>
  )
}

/** Reads an uploaded Markdown or text file as the Glossary body, dropping its own title. */
function UploadButton({ onText }: Readonly<{ onText: (text: string) => void }>) {
  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onText(withoutTitle(await file.text()))
  }
  return (
    <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-sheet px-2.5 text-[13px] hover:border-ink-faint">
      <Upload size={13} /> Upload .md
      <input type="file" accept=".md,.markdown,.txt,text/*" className="sr-only" onChange={onChange} />
    </label>
  )
}

interface CopySourceSelectProps {
  projects: ProjectSummary[]
  copyFrom: string
  onCopy: (projectId: string) => void
}

function CopySourceSelect({ projects, copyFrom, onCopy }: Readonly<CopySourceSelectProps>) {
  return (
    <select
      value={copyFrom}
      onChange={(event) => onCopy(event.target.value)}
      aria-label="Copy from Project"
      className="h-8 rounded-md border border-line bg-sheet px-2 text-sm"
    >
      <option value="" disabled>
        Choose a Project…
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  )
}

/** Under the preview: which terms the Glossary parser recognised, or a warning that it found none. */
function RecognisedTerms({ terms }: Readonly<{ terms: GlossaryTerm[] }>) {
  if (!terms.length)
    return (
      <p className="flex items-start gap-2 text-[13px] text-mark-ink">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        No terms in the Glossary format were found. Claude will still read it, but the Glossary panel won’t list its
        terms.
      </p>
    )
  const named = terms
    .slice(0, NAMED_TERMS)
    .map((term) => term.term)
    .join(', ')
  return (
    <p className="text-[13px] text-proof">
      {terms.length} term{terms.length === 1 ? '' : 's'} recognised
      <span className="text-ink-faint">
        : {named}
        {terms.length > NAMED_TERMS ? ', …' : ''}
      </span>
    </p>
  )
}

function EmptyGlossaryNote() {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-md border border-dashed border-line p-4 text-center text-sm text-ink-faint">
      <BookOpenText size={22} className="mb-2" />
      An empty Glossary. You can edit it any time from the Project page.
    </div>
  )
}

interface GlossaryPreviewProps {
  source: Exclude<Source, 'empty'>
  name: string
  body: string
  register: UseFormRegister<NewProjectFormData>
  /** The source's own control: an upload button for pasted text, a Project picker for a copy. */
  sourceControl: ReactNode
}

/** The starting Glossary as it will be saved: the Project name as its title, then the editable body. */
function GlossaryPreview({ source, name, body, register, sourceControl }: Readonly<GlossaryPreviewProps>) {
  const terms = parseGlossary(startingGlossary(name || NAME_PLACEHOLDER, body))
  return (
    <>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Preview</p>
        <span className="ml-auto" />
        {sourceControl}
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-fog/40 focus-within:border-claude">
        <p
          className="border-b border-line-soft px-3 py-1.5 font-mono text-[13px] text-ink-soft"
          title="Always the Project name"
        >
          # {name.trim() || NAME_PLACEHOLDER}
        </p>
        <textarea
          {...register('body')}
          rows={14}
          placeholder={source === 'paste' ? PASTE_PLACEHOLDER : ''}
          aria-label="Starting Glossary"
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed focus:outline-none"
        />
      </div>
      {body.trim() && <RecognisedTerms terms={terms} />}
    </>
  )
}

/**
 * The form, reset whenever the dialog opens. Picking a source clears the body; choosing a Project to
 * copy fetches its Glossary into the body once, after which the two are independent.
 */
function useCreateProjectForm(open: boolean) {
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

interface GlossaryStartProps {
  form: ReturnType<typeof useCreateProjectForm>
  projects: ProjectSummary[]
}

/** The dialog's right side: a note for an empty Glossary, else the preview with its source's control. */
function GlossaryStart({ form, projects }: Readonly<GlossaryStartProps>) {
  const { source } = form
  if (source === 'empty') return <EmptyGlossaryNote />
  const sourceControl =
    source === 'paste' ? (
      <UploadButton onText={form.setBody} />
    ) : (
      <CopySourceSelect
        projects={projects}
        copyFrom={form.copyFrom}
        onCopy={(projectId) => void form.copy(projectId)}
      />
    )
  return (
    <GlossaryPreview
      source={source}
      name={form.name}
      body={form.body}
      register={form.register}
      sourceControl={sourceControl}
    />
  )
}

interface SourceChoicesProps {
  current: Source
  /** Copying needs another Project to copy from. */
  offerCopy: boolean
  onPick: (source: Source) => void
}

function SourceChoices({ current, offerCopy, onPick }: Readonly<SourceChoicesProps>) {
  const shared = { current, onPick }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Glossary starts…</p>
      <SourceChoice
        {...shared}
        value="empty"
        icon={<FilePlus2 size={14} />}
        label="Empty"
        hint="Claude adds terms as you grill."
      />
      <SourceChoice
        {...shared}
        value="paste"
        icon={<ClipboardPaste size={14} />}
        label="From text I have"
        hint="Paste or upload any glossary."
      />
      {offerCopy && (
        <SourceChoice
          {...shared}
          value="copy"
          icon={<Copy size={14} />}
          label="As a copy of a Project"
          hint="Copied once, then independent."
        />
      )}
    </div>
  )
}

interface DialogActionsProps {
  canCreate: boolean
  onCancel: () => void
  onCreate: () => void
}

function DialogActions({ canCreate, onCancel, onCreate }: Readonly<DialogActionsProps>) {
  return (
    <>
      <Button variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="ink" disabled={!canCreate} onClick={onCreate}>
        Create Project
      </Button>
    </>
  )
}

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Names a new Project and chooses how its Glossary starts: empty, from text the human brings, or as a copy of
 * another Project's. The copy is taken once; the title is always the new Project's name.
 */
export function CreateProjectDialog({ open, onClose }: Readonly<CreateProjectDialogProps>) {
  const { data: projects = [] } = useProjects()
  const form = useCreateProjectForm(open)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Project"
      className="w-[min(920px,calc(100vw-32px))]"
      footer={<DialogActions canCreate={form.canCreate} onCancel={onClose} onCreate={form.onSubmit} />}
    >
      <form className="grid gap-5 md:grid-cols-[260px_1fr]" onSubmit={form.onSubmit}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Name</p>
            <TextInput
              {...form.register('name')}
              placeholder="e.g. Billing Platform"
              aria-label="Project name"
              autoFocus
            />
          </div>
          <SourceChoices current={form.source} offerCopy={projects.length > 0} onPick={form.pick} />
        </div>

        <div className="min-w-0 space-y-2">
          <GlossaryStart form={form} projects={projects} />
        </div>
      </form>
    </Dialog>
  )
}
