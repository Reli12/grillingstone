// Templates page banner for the Template Session that is running.
import { Link } from 'react-router'

import { MessageCircleQuestion } from 'lucide-react'

import type { TemplateSessionSummary } from '#core/session/sessionTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

export function LiveSessionBanner({ session }: Readonly<{ session: TemplateSessionSummary }>) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-3 text-sm">
      <MessageCircleQuestion size={16} className="text-claude" />
      <span className="flex-1">
        Template Session for a new {session.request.workItemType} Template is running
        {session.status === 'waiting' ? ' — your turn' : ''}.
      </span>
      <Link to={routesPaths.templateSession(session.id)}>
        <Button size="sm" variant="claude" tabIndex={-1}>
          Continue
        </Button>
      </Link>
    </div>
  )
}
