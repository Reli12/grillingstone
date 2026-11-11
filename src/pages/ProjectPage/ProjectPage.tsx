// A Project's page: its Drafts on a board of Lanes, its Backlog Copies (Azure DevOps Projects
// only), the whole Glossary to maintain, its Code Folders or its Settings — tabs, each at its own URL.
import { Link, useMatch, useParams } from 'react-router'

import { Plus } from 'lucide-react'

import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { BacklogCopiesPanel } from '@/components/features/backlogCopies/backlogCopiesPanel/backlogCopiesPanel'
import { CodeFoldersPanel } from '@/components/features/codeFolders/codeFoldersPanel/codeFoldersPanel'
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
import { ProjectDrafts } from '@/components/features/projects/projectDrafts/projectDrafts'
import { ProjectSettings } from '@/components/features/projects/projectSettings/projectSettings'
import { type ProjectTab, ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import { ProjectTitle } from '@/components/features/projects/projectTitle/projectTitle'
import { ProjectTracker } from '@/components/features/projects/projectTracker/projectTracker'
import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

/** Which tab the URL selects. */
function useSelectedTab(): ProjectTab {
  const glossary = useMatch(routesPaths.projectGlossary(':projectId')) !== null
  const backlog = useMatch(routesPaths.projectBacklog(':projectId')) !== null
  const code = useMatch(routesPaths.projectCode(':projectId')) !== null
  const settings = useMatch(routesPaths.projectSettings(':projectId')) !== null
  if (glossary) return 'glossary'
  if (code) return 'code'
  if (settings) return 'settings'
  return backlog ? 'backlog' : 'drafts'
}

export default function ProjectPage() {
  const { projectId = '' } = useParams()
  const requested = useSelectedTab()
  const { data: project, error } = useProject(projectId)
  const { data: drafts } = useDrafts(projectId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!project || !drafts) return <PageLoading />

  const showBacklog = project.tracker === 'azure-devops'
  // A Jira Project has no Backlog Copies, so its backlog URL shows the Drafts.
  const selected = requested === 'backlog' && !showBacklog ? 'drafts' : requested
  return (
    <div className="h-full overflow-y-auto">
      {/* The Drafts board fills the height that is left, so its columns scroll instead of the page. */}
      <div className={cn('mx-auto max-w-6xl px-4 py-10', selected === 'drafts' && 'flex h-full flex-col')}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <ProjectTitle project={project} />
            <ProjectTracker project={project} hasDrafts={drafts.length > 0} />
          </div>
          <Link to={routesPaths.newDraft(projectId)}>
            <Button variant="ink" size="lg" tabIndex={-1}>
              <Plus size={17} /> New Draft
            </Button>
          </Link>
        </div>
        <div className="mt-6 mb-4">
          <ProjectTabs projectId={projectId} selected={selected} showBacklog={showBacklog} />
        </div>
        {selected === 'glossary' && <GlossaryPanel projectId={projectId} />}
        {selected === 'backlog' && <BacklogCopiesPanel projectId={projectId} />}
        {selected === 'code' && <CodeFoldersPanel projectId={projectId} />}
        {selected === 'settings' && <ProjectSettings project={project} drafts={drafts} />}
        {selected === 'drafts' && <ProjectDrafts projectId={projectId} drafts={drafts} />}
      </div>
    </div>
  )
}
