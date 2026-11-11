// Step 3: Backlog Copies — fetching or pasting the BA's work items, Refreshing them, and what a change does.
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'

/** Step 3: Backlog Copies — fetching or pasting the BA's work items, Refreshing them, and what a change does. */
export function StepBacklogCopies() {
  return (
    <NumberedStep n={3} id="backlog" title={STEPS[2].title}>
      <p>
        A <strong>Backlog Copy</strong> is a local copy of one Azure DevOps work item — typically the BA’s Feature your
        PBIs implement — kept in the Project’s <strong>Backlog Copies</strong> tab. Drafts read the copy, never the live
        item, so a session always works from text you have seen.
      </p>
      <p>
        With a Connection, press <strong>Fetch from Azure DevOps</strong> and paste the item’s link (or type its ID):
        the title, type, description and Acceptance Criteria are read and saved for you, headings, lists and tables
        included. The item may live in any Azure DevOps project of your organization. Without a Connection, or whenever
        you prefer, <strong>Paste Backlog Copy</strong> lets you paste the same parts by hand.
      </p>
      <p>
        A copy never changes on its own. When the BA changes the item, the tab marks it{' '}
        <strong>Changed in Azure DevOps since your copy</strong>; press <strong>Refresh</strong> (or{' '}
        <strong>Refresh all</strong>), fetch it again, or re-paste it. If the text really changed, every Draft that
        references the copy is flagged and moves to Needs you, and its next session is given the new text together with
        what changed. Refreshing an unchanged item changes nothing.
      </p>
      <p>
        Click a copy’s title to read it, formatted as in Azure DevOps. With a Backlog chosen,{' '}
        <strong>Import as Draft</strong> turns the live item behind a copy into a Draft of its own.
      </p>
    </NumberedStep>
  )
}
