// Sample lines for the ownership-margin example: one per mark.
import { Lock } from 'lucide-react'

import { Tag } from '@/components/atoms/tag/tag'
import { ExampleFrame } from '@/components/composite/exampleFrame/exampleFrame'
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { Gutter } from '@/components/features/draft/margin/gutter/gutter'
import { GutterLegend } from '@/components/features/draft/margin/gutterLegend/gutterLegend'
import { STEPS } from '@/constants/GuideConstants'

/** Sample lines for the ownership-margin example: one per mark. */
const OWNERSHIP_EXAMPLES = [
  { edited: false, moved: false, text: 'Given an Account Admin views an invoice — written by Claude' },
  { edited: true, moved: false, text: 'Given a Member opens an invoice — edited by you' },
  { edited: false, moved: true, text: 'Acceptance Criteria — moved by you' },
]

/** Step 4: Editing the Draft by hand, Locked Sections and the ownership margin. */
export function StepDraft() {
  return (
    <NumberedStep n={4} id="draft" title={STEPS[3].title}>
      <p>
        From v1 on, the conversation sits on the left and the live Draft on the right. The Draft is yours to edit:{' '}
        <strong>click any text</strong> to change it, <strong>drag</strong> Sections and Entries into a new order,{' '}
        <strong>Discard</strong> what doesn’t belong (it stays restorable and is never copied out).
      </p>
      <p>
        Sections marked <Lock size={13} className="inline -translate-y-px" aria-label="Locked" /> are{' '}
        <strong>Locked</strong> — for a PBI, User Story and Acceptance Criteria; for a Bug, Steps to Reproduce, Expected
        and Actual Result; for a Task, Goal and Done When. You can edit and move them but never discard them. The small
        tag beside each heading, like <Tag tone="claude">Acceptance Criteria</Tag>, says which Azure DevOps field the
        Section goes into.
      </p>
      <p>
        The margin beside every Section and Entry shows who wrote it. That is not decoration: it decides what happens
        when Claude later proposes changes.
      </p>
      <ExampleFrame caption="The ownership margin: Claude’s text keeps a thin line; anything you edit gets a highlighter stroke; an arrow means you moved it.">
        <div className="space-y-3">
          {OWNERSHIP_EXAMPLES.map((example) => (
            <div key={example.text} className="flex min-h-9 gap-2">
              <Gutter size="entry" edited={example.edited} moved={example.moved} />
              <p className="font-serif text-ink">{example.text}</p>
            </div>
          ))}
          <div className="pt-2">
            <GutterLegend />
          </div>
        </div>
      </ExampleFrame>
    </NumberedStep>
  )
}
