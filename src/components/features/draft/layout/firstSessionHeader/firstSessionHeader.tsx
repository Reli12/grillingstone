// The Draft page's header before v1 exists: breadcrumbs, the Draft's title and its session controls.
import { Link } from 'react-router'

import { BookOpenText, Trash2 } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { CreatedFromPrototype } from '@/components/features/prototypes/createdFromPrototype/createdFromPrototype'
import { routesPaths } from '@/routes/routes'
import type { LayoutProps } from '@/types/draftPage'

export function FirstSessionHeader({
  projectId,
  projectName,
  draft,
  live,
  ui,
}: Readonly<Omit<LayoutProps, 'chat' | 'dialogs'>>) {
  return (
    <header className="flex shrink-0 items-start gap-4 border-b border-line bg-sheet/70 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-faint">
          <Link to={routesPaths.project(projectId)} className="hover:text-ink">
            {projectName}
          </Link>
          , new {draft.workItemType} in the {draft.template.name}
        </p>
        <p className="mt-0.5 line-clamp-2 font-serif text-[17px] text-ink">{draft.requirement}</p>
        {!!draft.createdFromPrototypeId && (
          <CreatedFromPrototype projectId={projectId} prototypeId={draft.createdFromPrototypeId} />
        )}
      </div>
      <Button
        size="sm"
        variant={ui.glossaryOpen ? 'ink' : 'outline'}
        onClick={() => ui.setGlossaryOpen((wasOpen) => !wasOpen)}
        aria-pressed={ui.glossaryOpen}
      >
        <BookOpenText size={14} /> Glossary
      </Button>
      {!live && (
        <Button size="sm" variant="quiet" onClick={() => ui.setDeleteOpen(true)} aria-label="Delete Draft">
          <Trash2 size={14} />
        </Button>
      )}
    </header>
  )
}
