import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { useProjects } from '@/api/hooks/projects/projectHooks'
import { cn } from '@/lib/cn'
import { lastProject, rememberProject } from '@/lib/lastProject'
import { routesPaths } from '@/routes/routes'

/** Header dropdown: the current (or last visited) Project, the others, and "New Project". */
export function ProjectSwitcher() {
  const { projectId: routeProject } = useParams()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)

  const { data: projects } = useProjects()

  const projectId = routeProject ?? lastProject() ?? undefined
  const current = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    if (routeProject) rememberProject(routeProject)
  }, [routeProject])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!projects?.length) return null
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-ink hover:bg-fog-deep"
      >
        {current?.name ?? 'Choose a Project'}
        <ChevronDown size={15} className="text-ink-faint" />
      </button>
      {open && (
        <div className="absolute top-9 left-0 z-30 w-64 rounded-lg border border-line bg-sheet p-1 shadow-[0_12px_32px_-12px_var(--color-shadow)]">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setOpen(false)
                navigate(routesPaths.project(p.id))
              }}
              className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-fog', p.id === projectId && 'font-semibold')}
            >
              {p.name}
              <span className="text-[13px] text-ink-faint">{p.drafts} Draft{p.drafts === 1 ? '' : 's'}</span>
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false)
              navigate(`${routesPaths.home}?newProject`)
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-line-soft px-2.5 py-2 text-left text-sm text-claude hover:bg-fog"
          >
            <Plus size={15} /> New Project
          </button>
        </div>
      )}
    </div>
  )
}
