// The Templates page: every Template by Work Item Type, with duplicate, export and import, and a link
// to a running Template Session.
import { type ChangeEvent, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Copy, Download, MessageCircleQuestion, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'

import type { TemplateSessionSummary } from '#core/session/sessionTypes.ts'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { useCreateTemplate, useExportTemplates, useTemplates } from '@/api/hooks/templates/templateHooks'
import { useLiveTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { Tag } from '@/components/atoms/tag/tag'
import { ImportDialog } from '@/components/features/templates/importDialog/importDialog'
import { downloadJson } from '@/lib/downloadJson'
import { routesPaths } from '@/routes/routes'

const DEFAULT_NAME_PREFIX = /^Default / // "Default " at the start of a shipped Template's name

/** A Default's copy is "My …"; any other Template's copy is "… (copy)". */
const copyName = (template: Template) =>
  template.isDefault ? template.name.replace(DEFAULT_NAME_PREFIX, 'My ') : `${template.name} (copy)`

/** The export's file name carries today's date (YYYY-MM-DD), so repeated exports don't overwrite each other. */
const bundleFileName = () => `templates-${new Date().toISOString().slice(0, 10)}.json`

/** The set with the id removed if it was there, or added if it was not. */
function toggled(ids: Set<string>, id: string) {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function LiveSessionBanner({ session }: Readonly<{ session: TemplateSessionSummary }>) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-3 text-sm">
      <MessageCircleQuestion size={16} className="text-claude" />
      <span className="flex-1">
        Template Session for a new {session.request.workItemType} Template is running
        {session.status === 'waiting' ? ' — your turn' : ''}.
      </span>
      <Link to={routesPaths.templateSession(session.id)}>
        <Button size="sm" variant="claude" tabIndex={-1}>
          Continue
        </Button>
      </Link>
    </div>
  )
}

interface TemplateRowProps {
  template: Template
  selected: boolean
  duplicating: boolean
  onToggle: () => void
  onDuplicate: () => void
}

function TemplateRow({ template, selected, duplicating, onToggle, onDuplicate }: Readonly<TemplateRowProps>) {
  const sectionCount = template.sections.length
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <input
        type="checkbox"
        className="accent-claude"
        aria-label={`Select ${template.name} for export`}
        checked={selected}
        onChange={onToggle}
      />
      <Link to={routesPaths.template(template.id)} className="min-w-0 flex-1 hover:underline">
        <span className="font-medium">{template.name}</span>
        <span className="ml-2 text-[13px] text-ink-faint">
          v{template.version}, {sectionCount} Section{sectionCount === 1 ? '' : 's'}
        </span>
      </Link>
      {template.isDefault && <Tag>Default, read-only</Tag>}
      <Button size="sm" variant="quiet" onClick={onDuplicate} disabled={duplicating}>
        <Copy size={14} /> Duplicate
      </Button>
    </li>
  )
}

interface PageActionsProps {
  selectedCount: number
  exporting: boolean
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: () => void
}

/** Import (through a hidden file input), export of the ticked Templates, and New Template. */
function PageActions({ selectedCount, exporting, onImportFile, onExport }: Readonly<PageActionsProps>) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        <Upload size={15} /> Import bundle
      </Button>
      <Button variant="outline" disabled={selectedCount === 0 || exporting} onClick={onExport}>
        <Download size={15} /> Export {selectedCount ? `${selectedCount} ` : ''}selected
      </Button>
      <Link to={routesPaths.newTemplate}>
        <Button variant="ink" tabIndex={-1}>
          <Plus size={15} /> New Template
        </Button>
      </Link>
    </>
  )
}

interface TemplateListsProps {
  templates: Template[]
  selected: Set<string>
  duplicating: boolean
  onToggle: (templateId: string) => void
  onDuplicate: (template: Template) => void
}

/** One list per Work Item Type, in the fixed type order. */
function TemplateLists({ templates, selected, duplicating, onToggle, onDuplicate }: Readonly<TemplateListsProps>) {
  return WORK_ITEM_TYPES.map((type) => (
    <section key={type} className="mt-10">
      <h2 className="mb-3 font-serif text-xl font-semibold">{type}</h2>
      <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
        {templates
          .filter((template) => template.workItemType === type)
          .map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              selected={selected.has(template.id)}
              duplicating={duplicating}
              onToggle={() => onToggle(template.id)}
              onDuplicate={() => onDuplicate(template)}
            />
          ))}
      </ul>
    </section>
  ))
}

/** Duplicating opens the copy; exporting downloads the ticked Templates; importing opens a file for preview. */
function useTemplateActions(selected: Set<string>, openBundle: (bundle: unknown) => void) {
  const navigate = useNavigate()
  const duplicate = useCreateTemplate()
  const exportBundle = useExportTemplates()

  const onDuplicate = (template: Template) =>
    duplicate.mutate(
      { ...template, name: copyName(template) },
      { onSuccess: (copy) => void navigate(routesPaths.template(copy.id)) },
    )
  const onExport = () =>
    exportBundle.mutate([...selected], { onSuccess: (exported) => downloadJson(bundleFileName(), exported) })
  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the input so choosing the same file again still fires a change.
    event.target.value = ''
    if (!file) return
    try {
      openBundle(JSON.parse(await file.text()))
    } catch {
      toast.error('That file is not valid JSON.')
    }
  }
  return { onDuplicate, onExport, onImportFile, duplicating: duplicate.isPending, exporting: exportBundle.isPending }
}

export default function TemplatesPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bundle, setBundle] = useState<unknown>(null)

  const { data: templates } = useTemplates()
  const { data: live } = useLiveTemplateSession()
  const actions = useTemplateActions(selected, setBundle)

  if (!templates) return <PageLoading />

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="font-serif text-[30px] leading-tight font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 max-w-xl text-ink-soft">
              A Template fixes the Sections a Draft must have and carries the method Claude writes them with. Editing
              one affects only new Drafts.
            </p>
          </div>
          <PageActions
            selectedCount={selected.size}
            exporting={actions.exporting}
            onImportFile={(event) => void actions.onImportFile(event)}
            onExport={actions.onExport}
          />
        </div>

        {live?.session && <LiveSessionBanner session={live.session} />}

        <TemplateLists
          templates={templates}
          selected={selected}
          duplicating={actions.duplicating}
          onToggle={(templateId) => setSelected(toggled(selected, templateId))}
          onDuplicate={actions.onDuplicate}
        />
      </div>
      <ImportDialog bundle={bundle} onClose={() => setBundle(null)} />
    </div>
  )
}
