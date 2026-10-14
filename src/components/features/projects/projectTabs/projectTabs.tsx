// The Project page's tabs, each at its own URL: the Drafts, or the whole Glossary to maintain.
import { Link } from 'react-router'

import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

interface ProjectTabsProps {
  projectId: string
  glossarySelected: boolean
}

const tabClass = (selected: boolean) =>
  cn(
    'flex h-8 items-center rounded-md px-3 text-sm',
    selected ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:text-ink',
  )

export function ProjectTabs({ projectId, glossarySelected }: Readonly<ProjectTabsProps>) {
  return (
    <nav role="tablist" aria-label="Project" className="flex gap-1">
      <Link
        role="tab"
        aria-selected={!glossarySelected}
        to={routesPaths.project(projectId)}
        className={tabClass(!glossarySelected)}
      >
        Drafts
      </Link>
      <Link
        role="tab"
        aria-selected={glossarySelected}
        to={routesPaths.projectGlossary(projectId)}
        className={tabClass(glossarySelected)}
      >
        Glossary
      </Link>
    </nav>
  )
}
