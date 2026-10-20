// A short, read-only view of the Project Glossary beside Drafts and sessions: term names only, each opening the
// Project's Glossary tab at that term, where the Glossary is maintained. Updates live like every Glossary view.
import { Link } from 'react-router'

import { ArrowRight } from 'lucide-react'

import { parseGlossary } from '#core/glossary/glossary.ts'
import { plural } from '#core/shared/plural.ts'

import { useGlossary } from '@/api/hooks/projects/projectHooks'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { routesPaths } from '@/routes/routes'

export function GlossaryPreview({ projectId }: Readonly<{ projectId: string }>) {
  const assistant = useAssistantLabel()
  const { data: doc } = useGlossary(projectId)
  if (!doc) return null
  const terms = parseGlossary(doc.markdown)
  const glossaryPath = routesPaths.projectGlossary(projectId)
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-ink-faint">{plural(terms.length, 'term')}</span>
        <Link to={glossaryPath} className="flex items-center gap-1 font-medium text-claude hover:underline">
          Open Glossary <ArrowRight size={13} />
        </Link>
      </div>
      {terms.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No terms yet. {assistant} adds them as they are settled during grilling, or add one in the Glossary tab.
        </p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-sheet p-1.5">
          {terms.map(({ term }, i) => (
            <li key={`${term}#${i}`}>
              <Link
                to={`${glossaryPath}?term=${encodeURIComponent(term)}`}
                className="block truncate rounded-md px-2 py-1 text-sm text-ink hover:bg-fog"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
