// A Project's page: its Drafts, a way to start a new one, and the Project Glossary beside them.
import { Link, useParams } from 'react-router'

import { Plus } from 'lucide-react'

import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { DraftList } from '@/components/features/drafts/draftList/draftList'
import { NoDraftsYet } from '@/components/features/drafts/noDraftsYet/noDraftsYet'
import { GlossaryAside } from '@/components/features/glossary/glossaryAside/glossaryAside'
import { ProjectTitle } from '@/components/features/projects/projectTitle/projectTitle'
import { routesPaths } from '@/routes/routes'

export default function ProjectPage() {
  const { projectId = '' } = useParams()
  const { data: project, error } = useProject(projectId)
  const { data: drafts } = useDrafts(projectId)

  if (error) return <div className="p-10 text-center text-ink-soft">{error.message}</div>
  if (!project || !drafts) return <PageLoading />

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ProjectTitle project={project} />
            <Link to={routesPaths.newDraft(projectId)}>
              <Button variant="ink" size="lg" tabIndex={-1}>
                <Plus size={17} /> New Draft
              </Button>
            </Link>
          </div>
          <div className="mt-6">
            {drafts.length ? <DraftList drafts={drafts} /> : <NoDraftsYet projectId={projectId} />}
          </div>
        </section>
        <GlossaryAside projectId={projectId} projectName={project.name} />
      </div>
    </div>
  )
}
