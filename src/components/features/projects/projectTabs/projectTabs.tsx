// The Project page's tabs, each at its own URL: the Drafts, the Backlog Copies (Azure DevOps Projects only), the
// whole Glossary to maintain, the Code Folders its sessions may read, or the Prototypes.
import { Link } from 'react-router'

import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'
import type { ProjectTab } from '@/types/projectPage'

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

const TABS = [
  { tab: 'drafts', label: 'Drafts', path: routesPaths.project },
  { tab: 'backlog', label: 'Backlog Copies', path: routesPaths.projectBacklog },
  { tab: 'glossary', label: 'Glossary', path: routesPaths.projectGlossary },
  { tab: 'code', label: 'Code Folders', path: routesPaths.projectCode },
  { tab: 'prototypes', label: 'Prototypes', path: routesPaths.projectPrototypes },
] as const satisfies ReadonlyArray<{ tab: ProjectTab; label: string; path: (projectId: string) => string }>

export function ProjectTabs({ projectId, selected, showBacklog }: Readonly<ProjectTabsProps>) {
  const tabs = TABS.filter(({ tab }) => showBacklog || tab !== 'backlog')
  return (
    <nav role="tablist" aria-label="Project" className="flex gap-1">
      {tabs.map(({ tab, label, path }) => (
        <Link
          key={tab}
          role="tab"
          aria-selected={selected === tab}
          to={path(projectId)}
          className={tabClass(selected === tab)}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
