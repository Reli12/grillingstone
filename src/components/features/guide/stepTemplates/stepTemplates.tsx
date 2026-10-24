// Step 7: Templates: duplicating, building, grilling and sharing them.
import { Link } from 'react-router'

import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'
import { routesPaths } from '@/routes/routes'

/** Step 7: Templates: duplicating, building, grilling and sharing them. */
export function StepTemplates() {
  return (
    <NumberedStep n={7} id="templates" title={STEPS[6].title}>
      <p>
        A <strong>Template</strong> decides which Sections a Draft must have and holds the writing method Claude
        follows, and each Template belongs to one Tracker. Each Section names the field it goes into — only fields its
        Work Item Type has, plus, in a Jira Template, any Custom Field your team added. The Default Templates are
        read-only; to change one, <strong>Duplicate</strong> it and edit your copy. Edits only affect new Drafts —
        existing ones get an <strong>Upgrade this Draft</strong> offer, which arrives as a Proposal.
      </p>
      <p>
        <strong>New Template</strong> offers two ways: <strong>Build it myself</strong>, or{' '}
        <strong>Grill it with Claude</strong> — a Template Session that interviews you about how your team writes this
        kind of work item and writes the Sections and method for you. Share Templates with colleagues through{' '}
        <strong>Export</strong> and <strong>Import bundle</strong>; an import never deletes anything.{' '}
        <Link to={routesPaths.templates} className="text-claude underline">
          Go to Templates
        </Link>
      </p>
    </NumberedStep>
  )
}
