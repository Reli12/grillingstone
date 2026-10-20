// One step of How it works, numbered and titled from its place in STEPS, so reordering touches only STEPS.
import type { ReactNode } from 'react'

import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { type StepId, STEPS } from '@/constants/GuideConstants'

/** A How it works step: its number and title come from STEPS by id. */
export function GuideStep({ id, children }: Readonly<{ id: StepId; children: ReactNode }>) {
  const index = STEPS.findIndex((step) => step.id === id)
  return (
    <NumberedStep n={index + 1} id={id} title={STEPS[index].title}>
      {children}
    </NumberedStep>
  )
}
