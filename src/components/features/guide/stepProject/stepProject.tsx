// How a Project and its Glossary work, and the three ways a Glossary starts.
import { Link } from 'react-router'

import { GuideStep } from '@/components/features/guide/guideStep/guideStep'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { routesPaths } from '@/routes/routes'

/** How a Project and its Glossary work, and the three ways a Glossary starts. */
export function StepProject() {
  const assistant = useAssistantLabel()
  return (
    <GuideStep id="project">
      <p>
        A <strong>Project</strong> is one product or body of work — say, “Customer Portal”. It keeps its Drafts together
        and owns one <strong>Glossary</strong>: the domain terms you and {assistant} settle while grilling, like what
        exactly an “Invoice” or an “Account Admin” is.
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
    </GuideStep>
  )
}
