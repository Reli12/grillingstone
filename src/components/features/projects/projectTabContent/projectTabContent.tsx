// What the selected tab of the Project page shows: the Drafts with the Glossary preview, the whole Glossary, or the
// Prototypes of every Draft.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { ProjectDrafts } from '@/components/features/projects/projectDrafts/projectDrafts'
import { ProjectPrototypesTab } from '@/components/features/prototypes/projectPrototypesTab/projectPrototypesTab'
import type { ProjectTab } from '@/types/projectPage'

interface ProjectTabContentProps {
  tab: ProjectTab
  projectId: string
  projectName: string
  drafts: DraftSummary[]
}

/** What the selected tab of the Project page shows. */
export function ProjectTabContent({ tab, projectId, projectName, drafts }: Readonly<ProjectTabContentProps>) {
  switch (tab) {
    case 'drafts':
      return <ProjectDrafts projectId={projectId} projectName={projectName} drafts={drafts} />
    case 'glossary':
      return <GlossaryPanel projectId={projectId} />
    case 'prototypes':
      return <ProjectPrototypesTab projectId={projectId} drafts={drafts} />
    default: {
      const _exhaustive: never = tab
      return _exhaustive
    }
  }
}
