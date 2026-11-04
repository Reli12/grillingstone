// A Project's page: its Drafts with the Glossary preview beside them, its Backlog Copies (Azure DevOps Projects
// only), the whole Glossary to maintain, its Code Folders, or the Prototypes of every Draft — tabs, each at its own URL.
import { Link, useMatch, useParams } from 'react-router'

import { Plus } from 'lucide-react'

import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ProjectTabContent } from '@/components/features/projects/projectTabContent/projectTabContent'
import { ProjectTabs } from '@/components/features/projects/projectTabs/projectTabs'
import { ProjectTitle } from '@/components/features/projects/projectTitle/projectTitle'
import { ProjectTracker } from '@/components/features/projects/projectTracker/projectTracker'
import { routesPaths } from '@/routes/routes'
import type { ProjectTab } from '@/types/projectPage'

/** Which tab the URL selects. */
function useSelectedTab(): ProjectTab {
  const glossary = useMatch(routesPaths.projectGlossary(':projectId')) !== null
  const backlog = useMatch(routesPaths.projectBacklog(':projectId')) !== null
  const code = useMatch(routesPaths.projectCode(':projectId')) !== null
  const prototypes = useMatch(routesPaths.projectPrototypes(':projectId')) !== null
  if (glossary) return 'glossary'
  if (code) return 'code'
  if (prototypes) return 'prototypes'
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
      <div className="mx-auto max-w-6xl px-4 py-10">
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
        <ProjectTabContent tab={selected} projectId={projectId} projectName={project.name} drafts={drafts} />
      </div>
    </div>
  )
}
