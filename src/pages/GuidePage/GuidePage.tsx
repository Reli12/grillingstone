// "How it works": one page that walks through working with the tool, in the order you meet it.
// The examples are the real components with sample content, so the page matches what you will see.

import { GoodToKnow } from '@/components/features/guide/goodToKnow/goodToKnow'
import { Intro } from '@/components/features/guide/intro/intro'
import { StepDraft } from '@/components/features/guide/stepDraft/stepDraft'
import { StepGrill } from '@/components/features/guide/stepGrill/stepGrill'
import { StepNav } from '@/components/features/guide/stepNav/stepNav'
import { StepProject } from '@/components/features/guide/stepProject/stepProject'
import { StepPublish } from '@/components/features/guide/stepPublish/stepPublish'
import { StepRefine } from '@/components/features/guide/stepRefine/stepRefine'
import { StepStart } from '@/components/features/guide/stepStart/stepStart'
import { StepTemplates } from '@/components/features/guide/stepTemplates/stepTemplates'
import { WhyGrillingStone } from '@/components/features/guide/whyGrillingStone/whyGrillingStone'

export default function GuidePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 lg:grid-cols-[200px_1fr]">
        <StepNav />
        <article className="max-w-[680px]">
          <Intro />
          <WhyGrillingStone />
          <div className="space-y-12">
            <StepProject />
            <StepStart />
            <StepGrill />
            <StepDraft />
            <StepRefine />
            <StepPublish />
            <StepTemplates />
          </div>
          <GoodToKnow />
        </article>
      </div>
    </div>
  )
}
