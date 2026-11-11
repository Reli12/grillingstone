// Step 2: The optional Connection to Azure DevOps, and a Project's Backlog and Default Tags.
import { Link } from 'react-router'

import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'
import { routesPaths } from '@/routes/routes'

/** Step 2: The optional Connection to Azure DevOps, and a Project's Backlog and Default Tags. */
export function StepConnect() {
  return (
    <NumberedStep n={2} id="connect" title={STEPS[1].title}>
      <p>
        Connecting is <strong>optional</strong>. Without it an Azure DevOps Project works by copy and paste: you paste
        the BA’s work items in and copy finished Drafts out. With it, the tool reads and writes Azure DevOps for you.
      </p>
      <p>
        Set up the <strong>Connection</strong> once, in{' '}
        <Link to={routesPaths.settings} className="text-claude underline">
          Settings
        </Link>
        : your organization URL and a Personal Access Token. The token is tested before anything is saved, stays on your
        machine and never reaches Claude; everything the tool does in Azure DevOps it does as you. If the token is
        rejected later, the tool says so and falls back to copy and paste until you replace it.
      </p>
      <p>
        Then, in the Project’s <strong>Settings</strong> tab, choose its <strong>Backlog</strong>: the Azure DevOps
        project its Drafts are Published into and Imported from. Type its name or paste any link from inside it; it must
        be Scrum or inherit from Scrum. Fetching and Refreshing Backlog Copies need only the Connection, so they work
        even before you choose a Backlog.
      </p>
      <p>
        <strong>Remove</strong> forgets the Backlog for this Project only — Publish and Import turn off, nothing in
        Azure DevOps changes, and you can choose one again at any time. Once any Draft has a Linked Work Item the
        Backlog is fixed: the tab lists those Drafts, and once you <strong>Unlink</strong> them you can change or remove
        it. <strong>Default Tags</strong>, set in the same tab, are offered for every work item Publish creates.
      </p>
    </NumberedStep>
  )
}
