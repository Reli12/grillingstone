// Step 3: The grilling conversation, the Ready Check and v1.
import { ExampleFrame } from '@/components/composite/exampleFrame/exampleFrame'
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'
import { STEPS } from '@/constants/GuideConstants'
import { exampleOnly } from '@/lib/exampleOnly'

/** Step 3: The grilling conversation, the Ready Check and v1. */
export function StepGrill() {
  return (
    <NumberedStep n={3} id="grill" title={STEPS[2].title}>
      <p>
        Until the first Draft exists the screen is one conversation. Claude asks <strong>one question at a time</strong>
        , and every question carries its recommended answer. Take the recommendation, pick an option, or answer in your
        own words.
      </p>
      <ExampleFrame caption="A question card. Try it — the answers here don’t go anywhere.">
        <QuestionCard
          q={{
            type: 'question',
            question: 'Who may export an invoice as PDF?',
            recommended: 'Account Admins only; Members can view but not export',
            options: ['Everyone who can view it', 'Account Admins only'],
          }}
          canAnswer
          onAnswer={exampleOnly}
        />
      </ExampleFrame>
      <p>
        When Claude thinks it knows enough it runs a <strong>Ready Check</strong>: “anything to add before I write it?”.
        Nothing is written until you confirm. You can also cut grilling short at any moment with{' '}
        <strong>Enough — write it</strong>; open points then land in the Draft’s Open Questions with Claude’s proposed
        default.
      </p>
      <p>
        Claude then writes <strong>v1</strong>. The tool checks it against the Template — every Section present, Locked
        Sections filled, empty ones saying “N/A — reason” — and refuses anything malformed, so what reaches you is
        always complete.
      </p>
      <p>
        <strong>Stop</strong> ends a session without writing anything. You can pick it up again later (see Continue in
        step 5).
      </p>
    </NumberedStep>
  )
}
