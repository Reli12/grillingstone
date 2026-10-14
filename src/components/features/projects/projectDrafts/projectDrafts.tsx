// The Project page's Drafts tab: the Drafts (or a first-Draft prompt) with the Glossary preview beside them.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { DraftList } from '@/components/features/drafts/draftList/draftList'
import { NoDraftsYet } from '@/components/features/drafts/noDraftsYet/noDraftsYet'
import { GlossaryAside } from '@/components/features/glossary/glossaryAside/glossaryAside'

interface ProjectDraftsProps {
  projectId: string
  projectName: string
  drafts: DraftSummary[]
}

export function ProjectDrafts({ projectId, projectName, drafts }: Readonly<ProjectDraftsProps>) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <section>{drafts.length ? <DraftList drafts={drafts} /> : <NoDraftsYet projectId={projectId} />}</section>
      <GlossaryAside projectId={projectId} projectName={projectName} />
    </div>
  )
}
