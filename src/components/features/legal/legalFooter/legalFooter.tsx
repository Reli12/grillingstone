// The slim line under every page: the copyright, the license, the running version and the way to the Legal page.
import { Link } from 'react-router'

import { COPYRIGHT_NOTICE } from '@/constants/LegalConstants'
import { APP_VERSION, RELEASE_NOTES_URL } from '@/constants/ReleaseConstants'
import { routesPaths } from '@/routes/routes'

/** Kept to one quiet text line so it takes almost no height from full-screen pages like the Draft editor. */
export function LegalFooter() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-sheet px-4 text-xs text-ink-faint">
      <span>{COPYRIGHT_NOTICE} · MIT License</span>
      <div className="flex items-center gap-3">
        <a href={RELEASE_NOTES_URL} target="_blank" rel="noreferrer" className="rounded hover:text-ink hover:underline">
          {APP_VERSION}
        </a>
        <Link to={routesPaths.legal} className="rounded hover:text-ink hover:underline">
          Legal
        </Link>
      </div>
    </footer>
  )
}
