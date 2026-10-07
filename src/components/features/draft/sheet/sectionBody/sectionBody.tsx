// A prose Section's text, editable in place; an Entries Section's sortable list.
import { RichText } from '@/components/atoms/richText/richText'
import { EditableText } from '@/components/features/draft/editing/editableText/editableText'
import { Entries } from '@/components/features/draft/sheet/entries/entries'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import type { EntriesProps } from '@/types/draft'

/** A prose Section's text, editable in place; an Entries Section's sortable list. */
export function SectionBody({ section, pending }: Readonly<EntriesProps>) {
  const { apply } = useDraftEditor()
  if (section.shape !== 'prose') return <Entries section={section} pending={pending} />
  return (
    <EditableText value={section.body} onSave={({ body }) => apply({ op: 'editSection', sectionId: section.id, body })}>
      <RichText text={section.body} className="font-serif text-[15px] leading-7 text-ink" />
    </EditableText>
  )
}
