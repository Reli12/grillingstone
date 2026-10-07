// The Home page's list of Projects with their Draft counts.
import { Link } from 'react-router'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { routesPaths } from '@/routes/routes'

export function ProjectList({ projects }: Readonly<{ projects: ProjectSummary[] }>) {
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
