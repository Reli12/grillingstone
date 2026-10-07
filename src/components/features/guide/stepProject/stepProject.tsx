// Step 1: How a Project and its Glossary work, and the three ways a Glossary starts.
import { Link } from 'react-router'

import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'
import { routesPaths } from '@/routes/routes'

/** Step 1: How a Project and its Glossary work, and the three ways a Glossary starts. */
export function StepProject() {
  return (
    <NumberedStep n={1} id="project" title={STEPS[0].title}>
      <p>
        A <strong>Project</strong> is one product or body of work — say, “Customer Portal”. It keeps its Drafts together
        and owns one <strong>Glossary</strong>: the domain terms you and Claude settle while grilling, like what exactly
        an “Invoice” or an “Account Admin” is.
      </p>
      <p>
        Every session in the Project is challenged against that Glossary, so a term decided in an Epic is known when you
        grill its PBIs. You can read and edit it on the Project page and beside any Draft.
      </p>
      <p>
        When you create a Project you choose how its Glossary starts: <strong>empty</strong>,{' '}
        <strong>from text you have</strong> (paste or upload any glossary), or{' '}
        <strong>as a copy of another Project’s</strong>. A copy is taken once; after that the two Glossaries change
        independently.{' '}
        <Link to={routesPaths.home} className="text-claude underline">
          Go to Projects
        </Link>
      </p>
    </NumberedStep>
  )
}
