// The Draft's Title, editable in place, with any pending retitle beneath it.
import { EditableText } from '@/components/features/draft/editing/editableText/editableText'
import { Gutter } from '@/components/features/draft/margin/gutter/gutter'
import { ChangeCard } from '@/components/features/draft/proposal/changeCard/changeCard'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { pendingTone } from '@/lib/pendingTone'

const WHITESPACE_RUN = /\s+/g // any run of spaces, tabs or newlines

/** The Draft's Title, editable in place, with any pending retitle beneath it. */
export function TitleBlock() {
  const { draft, pending, apply, decide, busy } = useDraftEditor()
  const titleChanges = pending.filter((change) => change.kind === 'retitle')
  // A title is one line: newlines typed into the editor collapse to single spaces.
  const saveTitle = (body: string) => apply({ op: 'retitle', title: body.replace(WHITESPACE_RUN, ' ') })
  return (
    <div className="flex gap-1">
      <Gutter edited={draft.titleHumanEdited} moved={false} pending={pendingTone(titleChanges)} />
      <div className="min-w-0 flex-1">
        <EditableText value={draft.title} onSave={({ body }) => saveTitle(body)}>
          <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-tight text-ink">{draft.title}</h1>
        </EditableText>
        {titleChanges.map((change) => (
          <div key={change.id} className="mt-2">
            <ChangeCard change={change} busy={busy} onDecide={(accept) => decide(change.id, accept)} />
          </div>
        ))}
      </div>
    </div>
  )
}
