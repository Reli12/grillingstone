// New Template: "Build it myself" or "Grill it with Claude".
import { Link } from 'react-router'

import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

interface StartActionsProps {
  /** The Template Session already running, if any: only one runs at a time. */
  runningId?: string
  canGrill: boolean
  starting: boolean
  creating: boolean
  onGrill: () => void
  onBuild: () => void
}

export function StartActions({
  runningId,
  canGrill,
  starting,
  creating,
  onGrill,
  onBuild,
}: Readonly<StartActionsProps>) {
  return (
    <div className="space-y-2">
      {runningId ? (
        <div className="rounded-md border border-claude/30 bg-claude-wash px-3 py-2.5 text-sm">
          A Template Session is already running.{' '}
          <Link to={routesPaths.templateSession(runningId)} className="font-medium text-claude underline">
            Continue it
          </Link>
        </div>
      ) : (
        <Button variant="claude" size="lg" className="w-full" disabled={!canGrill || starting} onClick={onGrill}>
          {starting ? 'Starting…' : 'Grill it with Claude'}
        </Button>
      )}
      <Button variant="outline" size="lg" className="w-full" disabled={creating} onClick={onBuild}>
        Build it myself
      </Button>
      <p className="text-[13px] text-ink-faint">
        {canGrill
          ? 'Claude asks one question at a time and writes nothing until you confirm.'
          : 'Describe what the Template is for to grill it with Claude.'}
      </p>
    </div>
  )
}
