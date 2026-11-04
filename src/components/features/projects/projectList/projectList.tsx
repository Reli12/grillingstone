// The Home page's list of Projects with their Draft counts, each with a Delete that asks first.
import { useState } from 'react'
import { Link } from 'react-router'

import { Trash2 } from 'lucide-react'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { DeleteProjectDialog } from '@/components/features/projects/deleteProjectDialog/deleteProjectDialog'
import { routesPaths } from '@/routes/routes'

export function ProjectList({ projects }: Readonly<{ projects: ProjectSummary[] }>) {
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)
  return (
    <>
      <ul className="mt-8 divide-y divide-line-soft rounded-lg border border-line bg-sheet">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center pr-2 hover:bg-fog/60">
            <Link to={routesPaths.project(project.id)} className="flex flex-1 items-center justify-between px-4 py-3.5">
              <span className="font-medium">{project.name}</span>
              <span className="text-sm text-ink-faint">
                {project.drafts} Draft{project.drafts === 1 ? '' : 's'}
              </span>
            </Link>
            <Button
              variant="danger"
              size="sm"
              aria-label={`Delete ${project.name}`}
              title="Delete Project"
              onClick={() => setDeleting(project)}
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {deleting && <DeleteProjectDialog key={deleting.id} project={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}
