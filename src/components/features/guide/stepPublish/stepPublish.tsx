// Copying the fields into Azure DevOps.
import { GuideStep } from '@/components/features/guide/guideStep/guideStep'

/** Copying the fields into Azure DevOps. */
export function StepPublish() {
  return (
    <GuideStep id="publish">
      <p>
        Press <strong>Copy for Azure DevOps</strong>. Each field has its own copy button and pastes as formatted text
        into the matching box on the work item: the Title, then the fields its type uses — Description and Acceptance
        Criteria for an Epic, Feature or PBI; Repro Steps, System Info and Acceptance Criteria for a Bug; Description
        alone for a Task. The Iteration Log goes along in Description — in Repro Steps for a Bug. Discarded content is
        left out and your order is kept. (Publishing straight to Azure DevOps is planned for a later version.)
      </p>
    </GuideStep>
  )
}
