// Template Session page header: breadcrumbs and what is being built.
import { Link } from 'react-router'

import { type TemplateRequest } from '#core/session/sessionTypes.ts'

import { routesPaths } from '@/routes/routes'

export function SessionHeader({ request }: Readonly<{ request: TemplateRequest }>) {
  return (
    <header className="shrink-0 border-b border-line bg-sheet/70 px-4 py-3 sm:px-6">
      <p className="text-[13px] text-ink-faint">
        <Link to={routesPaths.templates} className="hover:text-ink">
          Templates
        </Link>
        , new {request.workItemType} Template
        {request.baseTemplateName ? `, starting from the ${request.baseTemplateName}` : ''}
      </p>
      <p className="mt-0.5 line-clamp-2 font-serif text-[17px] text-ink">{request.purpose}</p>
    </header>
  )
}
