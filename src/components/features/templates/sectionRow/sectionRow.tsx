// Template editor: one Section row (heading, key, target field, options, row buttons).
import { type ReactNode } from 'react'

import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { HeadingField } from '@/components/features/templates/headingField/headingField'
import type { RowButtonsProps } from '@/components/features/templates/rowButtons/rowButtons'
import { RowButtons } from '@/components/features/templates/rowButtons/rowButtons'
import { SectionOptions } from '@/components/features/templates/sectionOptions/sectionOptions'
import { inputCls } from '@/constants/TemplateEditorConstants'
import { cn } from '@/lib/cn'
import type { FormPartProps, SectionFormData } from '@/types/templateForm'

interface SectionRowProps extends FormPartProps, Omit<RowButtonsProps, 'readOnly'> {
  section?: SectionFormData
  targetOptions: ReactNode
  onHeadingChange: (heading: string) => void
}

export function SectionRow({
  index,
  count,
  section,
  register,
  errors,
  readOnly,
  targetOptions,
  onHeadingChange,
  onMove,
  onRemove,
}: Readonly<SectionRowProps>) {
  const sectionErrors = errors.sections?.[index]
  return (
    <li className="rounded-lg border border-line bg-sheet p-3">
      <fieldset disabled={readOnly} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
        <HeadingField
          index={index}
          register={register}
          error={sectionErrors?.heading?.message}
          onChange={onHeadingChange}
        />
        <select {...register(`sections.${index}.target`)} aria-label="Azure DevOps field" className={inputCls}>
          {targetOptions}
        </select>
        <RowButtons index={index} count={count} readOnly={readOnly} onMove={onMove} onRemove={onRemove} />
        <input
          {...register(`sections.${index}.guidance`)}
          aria-label="Guidance"
          placeholder="One line of guidance for Claude and for you"
          className={cn(inputCls, 'sm:col-span-3')}
        />
        <SectionOptions index={index} register={register} isEntries={section?.shape === 'entries'} />
        <FieldError message={sectionErrors?.key?.message} />
      </fieldset>
    </li>
  )
}
