// The header's Project dropdown, which also remembers the last Project visited.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ChevronDown, Plus } from 'lucide-react'

import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { useProjects } from '@/api/hooks/projects/projectHooks'
import { cn } from '@/lib/cn'
import { lastProject, rememberProject } from '@/lib/lastProject'
import { routesPaths } from '@/routes/routes'

/** Closes the open menu on a mouse press anywhere outside it. */
function useCloseOnOutsidePress(open: boolean, setOpen: (open: boolean) => void) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPress = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPress)
    return () => document.removeEventListener('mousedown', onPress)
  }, [open, setOpen])
  return container
}

interface ProjectMenuProps {
  projects: ProjectSummary[]
  currentId?: string
  onGo: (path: string) => void
}

function ProjectMenu({ projects, currentId, onGo }: Readonly<ProjectMenuProps>) {
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

/** Header dropdown: the current (or last visited) Project, the others, and "New Project". */
export function ProjectSwitcher() {
  const { projectId: routeProject } = useParams()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const container = useCloseOnOutsidePress(open, setOpen)

  const { data: projects } = useProjects()

  const projectId = routeProject ?? lastProject() ?? undefined
  const current = projects?.find((project) => project.id === projectId)

  useEffect(() => {
    if (routeProject) rememberProject(routeProject)
  }, [routeProject])

  const go = (path: string) => {
    setOpen(false)
    void navigate(path)
  }

  if (!projects?.length) return null
  return (
    <div ref={container} className="relative">
      <button
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-ink hover:bg-fog-deep"
      >
        {current?.name ?? 'Choose a Project'}
        <ChevronDown size={15} className="text-ink-faint" />
      </button>
      {open && <ProjectMenu projects={projects} currentId={projectId} onGo={go} />}
    </div>
  )
}
