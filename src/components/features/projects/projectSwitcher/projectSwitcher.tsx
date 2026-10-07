// The header's Project dropdown, which also remembers the last Project visited.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ChevronDown } from 'lucide-react'

import { useProjects } from '@/api/hooks/projects/projectHooks'
import { ProjectMenu } from '@/components/features/projects/projectMenu/projectMenu'
import { useCloseOnOutsidePress } from '@/hooks/shared/useCloseOnOutsidePress'
import { lastProject, rememberProject } from '@/lib/lastProject'

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
