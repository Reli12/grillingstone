// Step 8: Publishing to Azure DevOps, or copying the fields into Azure DevOps or Jira.
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'

/** Step 8: Publishing to Azure DevOps, or copying the fields into Azure DevOps or Jira. */
export function StepPublish() {
  return (
    <NumberedStep n={8} id="publish" title={STEPS[7].title}>
      <p>
        With a Connection and a Backlog, press <strong>Publish</strong> on the Draft. You first see exactly what will be
        written — type, Backlog, Parent, area, tags and every field, or for an update only what changes — and nothing is
        written until you confirm. The first Publish creates the work item under the Draft’s Parent and links the Draft
        to it; every later Publish updates that same item. A Feature, PBI or Task needs a parent: its Parent, one it
        already has in Azure DevOps, or one you enter by ID or link in the dialog’s <strong>Parent</strong> field — no
        need to bring it in as a Backlog Copy first. Discarded content is left out and your order is kept.
      </p>
      <p>
        Wrote the Draft for an item that already exists? In the Publish dialog choose{' '}
        <strong>Update an existing work item</strong> and enter its ID or link: you see what changes before anything is
        written, and Publishing links the Draft to it instead of creating a duplicate. <strong>Unlink</strong> never
        touches Azure DevOps. If someone edits the item in Azure DevOps, the Draft shows possible <strong>Drift</strong>
        : <strong>Check for Drift</strong> brings those changes in as a Proposal to triage, and Publish waits until you
        have.
      </p>
      <p>
        No Connection? Press <strong>Copy for Azure DevOps</strong>. Each field has its own copy button and pastes as
        formatted text into the matching box on the work item: the Title, then the fields its type uses — Description
        and Acceptance Criteria for an Epic, Feature or PBI; Repro Steps, System Info and Acceptance Criteria for a Bug;
        Description alone for a Task. The Iteration Log goes along in Description — in Repro Steps for a Bug.
      </p>
      <p>
        In a Jira Project the button reads <strong>Copy for Jira</strong>: the Summary, then Description (with
        Acceptance Criteria under their own heading), Environment for a Bug, and any Custom Field your Template names. A
        switch at the top chooses <strong>Rich text</strong> for Jira Cloud or <strong>Wiki markup</strong> for Jira
        Data Center’s Text mode; the previews show exactly what will be pasted.
      </p>
    </NumberedStep>
  )
}
