// Starting a Draft: type, Template, requirement and References.
import { GuideStep } from '@/components/features/guide/guideStep/guideStep'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** Starting a Draft: type, Template, requirement and References. */
export function StepStart() {
  const assistant = useAssistantLabel()
  return (
    <GuideStep id="start">
      <p>
        Press <strong>New Draft</strong>, pick the <strong>Work Item Type</strong> (Epic, Feature, PBI, Task or Bug) and
        a <strong>Template</strong> — the Default one is preselected — then describe the requirement, or the bug you
        saw, in your own words. A sentence is enough; paste the BA’s Feature text or business rules if you have them.
      </p>
      <p>
        A <strong>Bug</strong> is grilled on what you observed: {assistant} never invents a step or result, and anything
        you don’t know becomes an Open Question. A <strong>Task</strong> is light — Reference its PBI or Bug and{' '}
        {assistant} asks only what that doesn’t already settle.
      </p>
      <p>
        Optionally tick <strong>References</strong>: other Drafts in the Project {assistant} may read as context, such
        as the Feature a PBI implements. They add context, not hierarchy.
      </p>
    </GuideStep>
  )
}
