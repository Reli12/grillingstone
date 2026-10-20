// The ordered Sections, each editable, movable and removable, plus "Add Section".
import { type ReactNode } from 'react'

import { Plus } from 'lucide-react'

import { type SectionTarget } from '#core/shared/adoFields.ts'

import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { SectionRow } from '@/components/features/templates/sectionRow/sectionRow'
import { SectionsIntro } from '@/components/features/templates/sectionsIntro/sectionsIntro'
import type { useTemplateForm } from '@/hooks/templates/useTemplateForm'
import type { FormPartProps, SectionFormData } from '@/types/templateForm'

const newSection = (position: number, target: SectionTarget): SectionFormData => ({
  key: `section${position}`,
  heading: '',
  shape: 'prose',
  locked: false,
  guidance: '',
  target,
  gherkin: false,
})

interface SectionsEditorProps extends FormPartProps {
  editor: ReturnType<typeof useTemplateForm>
  targetOptions: ReactNode
  /** What a new Section targets until the human picks another field. */
  firstTarget: SectionTarget
}

/** The ordered Sections, each editable, movable and removable, plus "Add Section". */
export function SectionsEditor({ editor, targetOptions, firstTarget, ...formPart }: Readonly<SectionsEditorProps>) {
  const { sections, followHeading } = editor
  const { fields, append, remove, move } = editor.sectionArray
  const { errors, readOnly } = formPart
  return (
    <section className="mt-10">
      <SectionsIntro />
      <FieldError message={errors.sections?.message ?? errors.sections?.root?.message} />
      <ol className="mt-4 space-y-2">
        {fields.map((field, i) => (
          <SectionRow
            key={field.id}
            {...formPart}
            index={i}
            count={fields.length}
            section={sections[i]}
            targetOptions={targetOptions}
            onHeadingChange={(heading) => followHeading(i, heading)}
            onMove={move}
            onRemove={remove}
          />
        ))}
      </ol>
      {!readOnly && (
        <Button
          size="sm"
          variant="quiet"
          className="mt-2"
          onClick={() => append(newSection(fields.length + 1, firstTarget))}
        >
          <Plus size={14} /> Add Section
        </Button>
      )}
    </section>
  )
}
