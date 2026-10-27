// A Project's page: its Drafts with the Glossary preview beside them, the whole Glossary to maintain, or the
// Prototypes of every Draft — three tabs, each at its own URL.
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

/** The tab the URL names: the Glossary and Prototypes have their own, anything else is the Drafts. */
function tabOf({ glossary, prototypes }: { glossary: boolean; prototypes: boolean }): ProjectTab {
  if (glossary) return 'glossary'
  return prototypes ? 'prototypes' : 'drafts'
}

export default function ProjectPage() {
  const { projectId = '' } = useParams()
  const tab = tabOf({
    glossary: useMatch(routesPaths.projectGlossary(':projectId')) !== null,
    prototypes: useMatch(routesPaths.projectPrototypes(':projectId')) !== null,
  })
  const { data: project, error } = useProject(projectId)
  const { data: drafts } = useDrafts(projectId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!project || !drafts) return <PageLoading />

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
          <ProjectTabs projectId={projectId} selected={tab} />
        </div>
        <ProjectTabContent tab={tab} projectId={projectId} projectName={project.name} drafts={drafts} />
      </div>
    </div>
  )
}
