import { useEffect, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpenText, ClipboardPaste, Copy, FilePlus2, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { parseGlossary, startingGlossary, withoutTitle } from '#core/glossary/glossary.ts'
import { useCreateProject, useProjects } from '@/api/hooks/projects/projectHooks'
import { projectsApi } from '@/api/projectsApi'
import { queryKeys } from '@/api/reactQueryKeys'
import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { cn } from '@/lib/cn'
import { newProjectSchema, type NewProjectFormData } from '@/lib/formSchemas/projectSchema'
import { routesPaths } from '@/routes/routes'

type Source = NewProjectFormData['source']

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Names a new Project and chooses how its Glossary starts: empty, from text the human brings, or as a copy of
 * another Project's. The copy is taken once; the title is always the new Project's name.
 */
export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: projects = [] } = useProjects()
  const create = useCreateProject()

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<NewProjectFormData>({
    resolver: zodResolver(newProjectSchema),
    mode: 'onChange',
    defaultValues: { name: '', source: 'empty', copyFrom: '', body: '' },
  })
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const [name, source, copyFrom, body] = watch(['name', 'source', 'copyFrom', 'body'])
  const glossary = source === 'empty' ? '' : startingGlossary(name || 'Project name', body)
  const terms = parseGlossary(glossary)

  const setBody = (text: string) => setValue('body', text, { shouldDirty: true })
  const copy = async (projectId: string) => {
    setValue('copyFrom', projectId)
    const doc = await qc.fetchQuery({ queryKey: queryKeys.glossary(projectId), queryFn: () => projectsApi.getGlossary(projectId) })
    setBody(withoutTitle(doc.markdown))
  }
  const pick = (s: Source) => {
    setValue('source', s)
    setBody('')
    if (s === 'copy' && copyFrom) void copy(copyFrom)
  }

  const onSubmit = handleSubmit(({ name, source, body }) => {
    const start = source === 'empty' ? '' : startingGlossary(name, body)
    create.mutate({ name, ...(start ? { glossary: start } : {}) }, { onSuccess: (p) => navigate(routesPaths.project(p.id)) })
  })

  const choice = (s: Source, icon: ReactNode, label: string, hint: string) => (
    <label className={cn('flex cursor-pointer gap-2.5 rounded-md border p-2.5', source === s ? 'border-claude bg-claude-wash' : 'border-line hover:border-ink-faint')}>
      <input type="radio" checked={source === s} onChange={() => pick(s)} className="mt-1 accent-(--color-claude)" aria-label={`${label}. ${hint}`} />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {label}
        </span>
        <span className="block text-[13px] text-ink-faint">{hint}</span>
      </span>
    </label>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Project"
      className="w-[min(920px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ink" disabled={!formState.isValid || create.isPending} onClick={onSubmit}>
            Create Project
          </Button>
        </>
      }
    >
      <form className="grid gap-5 md:grid-cols-[260px_1fr]" onSubmit={onSubmit}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Name</p>
            <TextInput {...register('name')} placeholder="e.g. Billing Platform" aria-label="Project name" autoFocus />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Glossary starts…</p>
            {choice('empty', <FilePlus2 size={14} />, 'Empty', 'Claude adds terms as you grill.')}
            {choice('paste', <ClipboardPaste size={14} />, 'From text I have', 'Paste or upload any glossary.')}
            {projects.length > 0 && choice('copy', <Copy size={14} />, 'As a copy of a Project', 'Copied once, then independent.')}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          {source === 'empty' ? (
            <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-md border border-dashed border-line p-4 text-center text-sm text-ink-faint">
              <BookOpenText size={22} className="mb-2" />
              An empty Glossary. You can edit it any time from the Project page.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Preview</p>
                <span className="ml-auto" />
                {source === 'paste' && (
                  <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-sheet px-2.5 text-[13px] hover:border-ink-faint">
                    <Upload size={13} /> Upload .md
                    <input
                      type="file"
                      accept=".md,.markdown,.txt,text/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) setBody(withoutTitle(await file.text()))
                      }}
                    />
                  </label>
                )}
                {source === 'copy' && (
                  <select
                    value={copyFrom}
                    onChange={(e) => void copy(e.target.value)}
                    aria-label="Copy from Project"
                    className="h-8 rounded-md border border-line bg-sheet px-2 text-sm"
                  >
                    <option value="" disabled>
                      Choose a Project…
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="overflow-hidden rounded-md border border-line bg-fog/40 focus-within:border-claude">
                <p className="border-b border-line-soft px-3 py-1.5 font-mono text-[13px] text-ink-soft" title="Always the Project name">
                  # {name.trim() || 'Project name'}
                </p>
                <textarea
                  {...register('body')}
                  rows={14}
                  placeholder={source === 'paste' ? 'Paste your glossary here, in any format. A # Title line is replaced by the Project name.' : ''}
                  aria-label="Starting Glossary"
                  className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed focus:outline-none"
                />
              </div>
              {body.trim() &&
                (terms.length ? (
                  <p className="text-[13px] text-proof">
                    {terms.length} term{terms.length === 1 ? '' : 's'} recognised
                    <span className="text-ink-faint">
                      : {terms.slice(0, 6).map((t) => t.term).join(', ')}
                      {terms.length > 6 ? ', …' : ''}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-[13px] text-mark-ink">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    No terms in the Glossary format were found. Claude will still read it, but the Glossary panel won’t list its terms.
                  </p>
                ))}
            </>
          )}
        </div>
      </form>
    </Dialog>
  )
}
