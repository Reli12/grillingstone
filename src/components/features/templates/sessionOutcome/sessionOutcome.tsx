// Under an ended session: the Template it made, or a way to start over.
import { Link } from 'react-router'

import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

/** Under an ended session: the Template it made, or a way to start over. */
export function SessionOutcome({ templateId }: Readonly<{ templateId?: string }>) {
  return (
    <div className="shrink-0 border-t border-line bg-sheet px-4 py-4 text-center">
      {templateId ? (
        <>
          <p className="text-sm text-ink-soft">This session created a Template.</p>
          <Link to={routesPaths.template(templateId)}>
            <Button className="mt-2" variant="ink" tabIndex={-1}>
              Open the Template
            </Button>
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            The session ended without a Template. Sessions are never resumed — start a new one.
          </p>
          <Link to={routesPaths.newTemplate}>
            <Button className="mt-2" variant="claude" tabIndex={-1}>
              New Template
            </Button>
          </Link>
        </>
      )}
    </div>
  )
}
