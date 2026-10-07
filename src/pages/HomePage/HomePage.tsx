// The home page: the Project list, or a welcome on first run, and the New Project dialog.
import { Link, useSearchParams } from 'react-router'

import { Plus } from 'lucide-react'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { useProjects } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { CreateProjectDialog } from '@/components/features/projects/createProjectDialog/createProjectDialog'
import { routesPaths } from '@/routes/routes'

function ProjectList({ projects }: Readonly<{ projects: ProjectSummary[] }>) {
  return (
    <ul className="mt-8 divide-y divide-line-soft rounded-lg border border-line bg-sheet">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            to={routesPaths.project(project.id)}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-fog/60"
          >
            <span className="font-medium">{project.name}</span>
            <span className="text-sm text-ink-faint">
              {project.drafts} Draft{project.drafts === 1 ? '' : 's'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  const { data: projects, isLoading } = useProjects()
  // ?newProject opens the dialog straight away (the header's "New Project" links here).
  const [params, setParams] = useSearchParams()
  const creating = params.has('newProject')
  const setCreating = (open: boolean) => setParams(open ? { newProject: '' } : {}, { replace: true })

  if (isLoading) return <PageLoading />
  const first = !projects?.length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="font-serif text-[34px] leading-tight font-semibold tracking-tight">
          {first ? 'Grill a requirement into a work item.' : 'Projects'}
        </h1>
        <p className="mt-3 max-w-xl text-ink-soft">
          {first
            ? 'Start with a Project for the product you work on. Each Project keeps its own Glossary, so terms settled in one Draft are known in the next.'
            : 'Each Project keeps its Drafts and its own Glossary apart.'}
        </p>

        {!first && <ProjectList projects={projects} />}

        <Button variant="ink" size="lg" className="mt-8" onClick={() => setCreating(true)}>
          <Plus size={16} /> New Project
        </Button>
        <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    </div>
  )
}
