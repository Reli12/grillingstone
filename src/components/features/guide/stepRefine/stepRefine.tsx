// Focused Sessions, New Iterations, Continue, and how Proposals are triaged.
import type { Change } from '#core/proposal/proposalTypes.ts'

import { ExampleFrame } from '@/components/composite/exampleFrame/exampleFrame'
import { ChangeCard } from '@/components/features/draft/proposal/changeCard/changeCard'
import { GuideStep } from '@/components/features/guide/guideStep/guideStep'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { exampleOnly } from '@/lib/exampleOnly'

const cleanExample: Change = {
  id: 'ex-clean',
  kind: 'replaceEntry',
  label: 'Scope · add the invoice list',
  before: 'In scope\nExport a single invoice as PDF from the invoice detail page',
  after: 'In scope\nExport a single invoice as PDF from the invoice detail page or the invoice list',
  conflict: false,
  status: 'pending',
}

const conflictExample: Change = {
  id: 'ex-conflict',
  kind: 'replaceEntry',
  label: 'AC02 · cover the list page',
  before: 'Given a Member opens an invoice\nThen the Export PDF action is hidden',
  after:
    'Given a Member views one or more invoices\nWhen the invoice list or detail page is shown\nThen no export action is available',
  conflict: true,
  conflictReason: 'You hand-edited this',
  status: 'pending',
}

/** Focused Sessions, New Iterations, Continue, and how Proposals are triaged. */
export function StepRefine() {
  const assistant = useAssistantLabel()
  return (
    <GuideStep id="refine">
      <p>
        To rework one part, hover it and press <strong>Grill this</strong> — a <strong>Focused Session</strong> on just
        that Section or Entry. To re-grill the whole Draft (say, the BA revised the Feature), type in the message box on
        the left; that starts a <strong>New Iteration</strong>. Every session gets the current Draft and the Glossary.
      </p>
      <p>
        To pick up an earlier conversation instead — one you stopped, or one where a new fact turned up afterwards —
        press <strong>Continue</strong> on that session. {assistant} remembers everything it asked there, but the
        current Draft still counts over anything said earlier.
      </p>
      <p>
        After v1, {assistant} never rewrites the Draft. It returns a <strong>Proposal</strong>, shown inline where each
        change would land:
      </p>
      <ExampleFrame
        caption={`A Clean Change touches only what ${assistant} wrote and you never touched — accept these in one go with “Accept all clean”.`}
      >
        <ChangeCard change={cleanExample} assistant={assistant} busy={false} onDecide={exampleOnly(assistant)} />
      </ExampleFrame>
      <ExampleFrame
        caption={`A Conflict touches something you edited, moved or discarded — your version stands beside ${assistant}’s, and you decide each one.`}
      >
        <ChangeCard change={conflictExample} assistant={assistant} busy={false} onDecide={exampleOnly(assistant)} />
      </ExampleFrame>
      <p>
        When nothing is left to decide, the Draft becomes the next version and the <strong>Iteration Log</strong> gains
        a line. Rejected changes leave the Draft untouched.
      </p>
    </GuideStep>
  )
}
