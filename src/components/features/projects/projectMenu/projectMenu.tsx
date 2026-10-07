// The Project switcher's dropdown: every Project, plus New Project.
import { Plus } from 'lucide-react'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

interface ProjectMenuProps {
  projects: ProjectSummary[]
  currentId?: string
  onGo: (path: string) => void
}

export function ProjectMenu({ projects, currentId, onGo }: Readonly<ProjectMenuProps>) {
  return (
    <div className="absolute top-9 left-0 z-30 w-64 rounded-lg border border-line bg-sheet p-1 shadow-[0_12px_32px_-12px_var(--color-shadow)]">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onGo(routesPaths.project(project.id))}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-fog',
            project.id === currentId && 'font-semibold',
          )}
        >
          {project.name}
          <span className="text-[13px] text-ink-faint">
            {project.drafts} Draft{project.drafts === 1 ? '' : 's'}
          </span>
        </button>
      ))}
      <button
        // The home page opens the New Project dialog when it sees ?newProject.
        onClick={() => onGo(`${routesPaths.home}?newProject`)}
        className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-line-soft px-2.5 py-2 text-left text-sm text-claude hover:bg-fog"
      >
        <Plus size={15} /> New Project
      </button>
    </div>
  )
}
