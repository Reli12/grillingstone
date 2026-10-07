// The Project page's Glossary column: a short explanation and the Glossary panel.
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'

export function GlossaryAside({ projectId, projectName }: Readonly<{ projectId: string; projectName: string }>) {
  return (
    <aside>
      <h2 className="font-serif text-lg font-semibold">Glossary</h2>
      <p className="mb-4 text-[13px] text-ink-faint">
        Shared by every Draft in {projectName}. Every session is challenged against it.
      </p>
      <GlossaryPanel projectId={projectId} />
    </aside>
  )
}
