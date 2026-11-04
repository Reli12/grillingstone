// What the selected tab of the Project page shows: the Drafts with the Glossary preview, the Backlog Copies, the whole
// Glossary, the Code Folders, or the Prototypes of every Draft.
import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { BacklogCopiesPanel } from '@/components/features/backlogCopies/backlogCopiesPanel/backlogCopiesPanel'
import { CodeFoldersPanel } from '@/components/features/codeFolders/codeFoldersPanel/codeFoldersPanel'
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
    case 'backlog':
      return <BacklogCopiesPanel projectId={projectId} />
    case 'glossary':
      return <GlossaryPanel projectId={projectId} />
    case 'code':
      return <CodeFoldersPanel projectId={projectId} />
    case 'prototypes':
      return <ProjectPrototypesTab projectId={projectId} drafts={drafts} />
    default: {
      const _exhaustive: never = tab
      return _exhaustive
    }
  }
}
