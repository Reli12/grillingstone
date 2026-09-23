import { useRef, useState } from 'react'
import { Copy, Download, MessageCircleQuestion, Plus, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
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

export default function TemplatesPage() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bundle, setBundle] = useState<unknown | null>(null)

  const { data: templates } = useTemplates()
  const { data: live } = useLiveTemplateSession()
  const duplicate = useCreateTemplate()
  const exportBundle = useExportTemplates()

  if (!templates) return <PageLoading />

  const onDuplicate = (t: Template) =>
    duplicate.mutate({ ...t, name: t.isDefault ? t.name.replace(/^Default /, 'My ') : `${t.name} (copy)` }, { onSuccess: (copy) => navigate(routesPaths.template(copy.id)) })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="font-serif text-[30px] leading-tight font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 max-w-xl text-ink-soft">A Template fixes the Sections a Draft must have and carries the method Claude writes them with. Editing one affects only new Drafts.</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                setBundle(JSON.parse(await file.text()))
              } catch {
                toast.error('That file is not valid JSON.')
              }
            }}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Import bundle
          </Button>
          <Button
            variant="outline"
            disabled={selected.size === 0 || exportBundle.isPending}
            onClick={() => exportBundle.mutate([...selected], { onSuccess: (b) => downloadJson(`templates-${new Date().toISOString().slice(0, 10)}.json`, b) })}
          >
            <Download size={15} /> Export {selected.size ? `${selected.size} ` : ''}selected
          </Button>
          <Link to={routesPaths.newTemplate}>
            <Button variant="ink" tabIndex={-1}>
              <Plus size={15} /> New Template
            </Button>
          </Link>
        </div>

        {live?.session && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-3 text-sm">
            <MessageCircleQuestion size={16} className="text-claude" />
            <span className="flex-1">
              Template Session for a new {live.session.request.workItemType} Template is running{live.session.status === 'waiting' ? ' — your turn' : ''}.
            </span>
            <Link to={routesPaths.templateSession(live.session.id)}>
              <Button size="sm" variant="claude" tabIndex={-1}>
                Continue
              </Button>
            </Link>
          </div>
        )}

        {WORK_ITEM_TYPES.map((type) => (
          <section key={type} className="mt-10">
            <h2 className="mb-3 font-serif text-xl font-semibold">{type}</h2>
            <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
              {templates
                .filter((t) => t.workItemType === type)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-claude"
                      aria-label={`Select ${t.name} for export`}
                      checked={selected.has(t.id)}
                      onChange={() => {
                        const next = new Set(selected)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        setSelected(next)
                      }}
                    />
                    <Link to={routesPaths.template(t.id)} className="min-w-0 flex-1 hover:underline">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-[13px] text-ink-faint">
                        v{t.version}, {t.sections.length} Section{t.sections.length === 1 ? '' : 's'}
                      </span>
                    </Link>
                    {t.isDefault && <Tag>Default, read-only</Tag>}
                    <Button size="sm" variant="quiet" onClick={() => onDuplicate(t)} disabled={duplicate.isPending}>
                      <Copy size={14} /> Duplicate
                    </Button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <ImportDialog bundle={bundle} onClose={() => setBundle(null)} />
    </div>
  )
}
