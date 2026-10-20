// The Templates page: every Template by Work Item Type, with duplicate, export and import, and a link
// to a running Template Session.
import { useState } from 'react'

import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { useLiveTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ImportDialog } from '@/components/features/templates/importDialog/importDialog'
import { LiveSessionBanner } from '@/components/features/templates/liveSessionBanner/liveSessionBanner'
import { PageActions } from '@/components/features/templates/pageActions/pageActions'
import { TemplateLists } from '@/components/features/templates/templateLists/templateLists'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { useTemplateActions } from '@/hooks/templates/useTemplateActions'

/** The set with the id removed if it was there, or added if it was not. */
function toggled(ids: Set<string>, id: string) {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export default function TemplatesPage() {
  const assistant = useAssistantLabel()
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
              A Template fixes the Sections a Draft must have and carries the method {assistant} writes them with.
              Editing one affects only new Drafts.
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
