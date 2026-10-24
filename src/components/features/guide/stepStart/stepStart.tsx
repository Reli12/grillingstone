// Step 2: Starting a Draft: type, Template, requirement and References.
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { STEPS } from '@/constants/GuideConstants'

/** Step 2: Starting a Draft: type, Template, requirement and References. */
export function StepStart() {
  return (
    <NumberedStep n={2} id="start" title={STEPS[1].title}>
      <p>
        Press <strong>New Draft</strong>, pick the <strong>Work Item Type</strong> (Epic, Feature, PBI, Task or Bug in
        Azure DevOps; Epic, Story, Task, Sub-task or Bug in Jira) and a <strong>Template</strong> — the Default one is
        preselected — then describe the requirement, or the bug you saw, in your own words. A sentence is enough; paste
        the BA’s Feature text or business rules if you have them.
      </p>
      <p>
        A <strong>Bug</strong> is grilled on what you observed: Claude never invents a step or result, and anything you
        don’t know becomes an Open Question. An Azure DevOps <strong>Task</strong> or a Jira
        <strong>Sub-task</strong> is light — Reference the item it belongs to and Claude asks only what that doesn’t
        already settle.
      </p>
      <p>
        Optionally tick <strong>References</strong>: other Drafts in the Project Claude may read as context, such as the
        Feature a PBI implements. They add context, not hierarchy.
      </p>
    </NumberedStep>
  )
}
