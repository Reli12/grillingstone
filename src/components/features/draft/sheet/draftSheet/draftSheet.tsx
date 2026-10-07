// The live Draft as one sheet of paper: Title, Sections in the human's order, the Iteration Log,
// and — while a Proposal is open — its changes inline where they would land.

import { GutterLegend } from '@/components/features/draft/margin/gutterLegend/gutterLegend'
import { NewSectionChanges } from '@/components/features/draft/proposal/newSectionChanges/newSectionChanges'
import { IterationLog } from '@/components/features/draft/sheet/iterationLog/iterationLog'
import { SortableSections } from '@/components/features/draft/sheet/sortableSections/sortableSections'
import { TitleBlock } from '@/components/features/draft/sheet/titleBlock/titleBlock'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

export function DraftSheet() {
  const { draft } = useDraftEditor()
  return (
    <article className="mx-auto w-full max-w-[860px]">
      <TitleBlock />
      <SortableSections />
      <NewSectionChanges />
      <IterationLog heading={draft.template.iterationLogHeading} log={draft.iterationLog} />
      <div className="mt-10 pb-4 pl-8">
        <GutterLegend />
      </div>
    </article>
  )
}
