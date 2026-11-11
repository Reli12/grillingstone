// The Project page's tabs, each at its own URL: the Drafts, the Backlog Copies (Azure DevOps Projects only), the
// whole Glossary to maintain, the Code Folders its sessions may read, or the Project's Settings.
import { Link } from 'react-router'

import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

export type ProjectTab = 'drafts' | 'backlog' | 'glossary' | 'code' | 'settings'

interface ProjectTabsProps {
  projectId: string
  selected: ProjectTab
  /** Backlog Copies exist only in Azure DevOps Projects. */
  showBacklog: boolean
}

const tabClass = (selected: boolean) =>
  cn(
    'flex h-8 items-center rounded-md px-3 text-sm',
    selected ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink',
  )

export function ProjectTabs({ projectId, selected, showBacklog }: Readonly<ProjectTabsProps>) {
  const tabs: [ProjectTab, string, string][] = [
    ['drafts', 'Drafts', routesPaths.project(projectId)],
    ...(showBacklog
      ? [['backlog', 'Backlog Copies', routesPaths.projectBacklog(projectId)] as [ProjectTab, string, string]]
      : []),
    ['glossary', 'Glossary', routesPaths.projectGlossary(projectId)],
    ['code', 'Code Folders', routesPaths.projectCode(projectId)],
    ['settings', 'Settings', routesPaths.projectSettings(projectId)],
  ]
  return (
    <nav role="tablist" aria-label="Project" className="flex gap-1">
      {tabs.map(([tab, label, to]) => (
        <Link key={tab} role="tab" aria-selected={selected === tab} to={to} className={tabClass(selected === tab)}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
