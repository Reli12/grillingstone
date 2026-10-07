import { Link, useParams } from 'react-router'

import { Plus } from 'lucide-react'

import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { EmptyState } from '@/components/composite/emptyState/emptyState'
import { DraftList } from '@/components/features/drafts/draftList/draftList'
import { GlossaryPanel } from '@/components/features/glossary/glossaryPanel/glossaryPanel'
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
            {drafts.length ? (
              <DraftList drafts={drafts} />
            ) : (
              <EmptyState
                title="No Drafts in this Project yet"
                action={
                  <Link to={routesPaths.newDraft(projectId)}>
                    <Button variant="claude" tabIndex={-1}>
                      Grill your first requirement
                    </Button>
                  </Link>
                }
              >
                Describe a requirement or a bug, pick its Work Item Type, and Claude grills it with you until it can be
                written down.
              </EmptyState>
            )}
          </div>
        </section>
        <aside>
          <h2 className="font-serif text-lg font-semibold">Glossary</h2>
          <p className="mb-4 text-[13px] text-ink-faint">
            Shared by every Draft in {project.name}. Every session is challenged against it.
          </p>
          <GlossaryPanel projectId={projectId} />
        </aside>
      </div>
    </div>
  )
}
