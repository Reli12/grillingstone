// The Entry's title and text, editable in place, with its Grill and Discard actions.
import { RichText } from '@/components/atoms/richText/richText'
import { EditableText } from '@/components/features/draft/editing/editableText/editableText'
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import type { EntryProps } from '@/types/draft'

/** The Entry's title and text, editable in place, with its Grill and Discard actions. */
export function EntryContent({ section, entry }: Readonly<EntryProps>) {
  const { apply, grill, sessionRunning } = useDraftEditor()
  const target = { sectionId: section.id, entryId: entry.id }
  return (
    <div className="flex items-start gap-2">
      <EditableText
        className="min-w-0 flex-1"
        value={entry.body}
        title={entry.title}
        onSave={({ body, title }) => apply({ op: 'editEntry', ...target, body, title })}
      >
        <p className="font-serif text-[15px] leading-7 font-semibold text-ink">{entry.title}</p>
        <RichText text={entry.body} className="font-serif text-[15px] leading-7 text-ink" />
      </EditableText>
      <RowActions
        entry
        grillDisabled={sessionRunning}
        onGrill={() => grill({ ...target, heading: `${section.heading} › ${entry.title}` })}
        onDiscard={() => apply({ op: 'discardEntry', ...target })}
      />
    </div>
  )
}
