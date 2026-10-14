// Before v1: the session is a full-screen chat, with the Glossary on demand.
import { FirstSessionHeader } from '@/components/features/draft/layout/firstSessionHeader/firstSessionHeader'
import { GlossaryPreview } from '@/components/features/glossary/glossaryPreview/glossaryPreview'
import type { LayoutProps } from '@/types/draftPage'

/** Before v1: the session is a full-screen chat, with the Glossary on demand. */
export function FirstSessionLayout({ chat, dialogs, ...headerProps }: Readonly<LayoutProps>) {
  const { projectId, projectName, ui } = headerProps
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <FirstSessionHeader {...headerProps} />
        {chat}
      </div>
      {ui.glossaryOpen && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-sheet p-4">
          <h2 className="mb-3 font-serif text-lg font-semibold">{projectName} Glossary</h2>
          <GlossaryPreview projectId={projectId} />
        </aside>
      )}
      {dialogs}
    </div>
  )
}
