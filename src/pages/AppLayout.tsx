// The frame around every page: the header with the Project switcher and navigation, and a banner
// while the backend can't be reached.
import { NavLink, Outlet, useParams } from 'react-router'

import { Wordmark } from '@/components/atoms/wordmark/wordmark'
import { ProjectSwitcher } from '@/components/features/projects/projectSwitcher/projectSwitcher'
import { useBackendConnection } from '@/context/ServerEvents/ServerEvents'
import { cn } from '@/lib/cn'
import { lastProject } from '@/lib/lastProject'
import { routesPaths } from '@/routes/routes'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2.5 py-1.5 text-sm text-ink-soft hover:bg-fog-deep hover:text-ink',
    isActive && 'bg-fog-deep text-ink font-medium',
  )

export default function AppLayout() {
  const connection = useBackendConnection()
  const projectId = useParams().projectId ?? lastProject()
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-sheet px-4">
        <NavLink to={projectId ? routesPaths.project(projectId) : routesPaths.home} className="rounded">
          <Wordmark />
        </NavLink>
        <span className="h-5 w-px bg-line" aria-hidden />
        <ProjectSwitcher />
        <nav className="ml-auto flex items-center gap-1">
          <NavLink to={routesPaths.guide} className={navClass}>
            How it works
          </NavLink>
          <NavLink to={routesPaths.templates} className={navClass}>
            Templates
          </NavLink>
          <NavLink to={routesPaths.settings} className={navClass}>
            Settings
          </NavLink>
        </nav>
      </header>
      {connection === 'closed' && (
        <div className="shrink-0 bg-redpencil px-4 py-1.5 text-sm text-on-accent" role="alert">
          Can’t reach the backend. Is <code className="font-semibold">npm run dev</code> still running? Reconnecting…
        </div>
      )}
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
