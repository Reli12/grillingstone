// The Project page's Glossary column beside the Drafts: a short explanation and the read-only preview.
import { GlossaryPreview } from '@/components/features/glossary/glossaryPreview/glossaryPreview'

export function GlossaryAside({ projectId, projectName }: Readonly<{ projectId: string; projectName: string }>) {
  return (
    <aside className="self-start lg:sticky lg:top-6">
      <h2 className="font-serif text-lg font-semibold">Glossary</h2>
      <p className="mb-4 text-[13px] text-ink-faint">
        Shared by every Draft in {projectName}. Every session is challenged against it.
      </p>
      <GlossaryPreview projectId={projectId} />
    </aside>
  )
}
