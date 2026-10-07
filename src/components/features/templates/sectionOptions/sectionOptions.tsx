// The Section's key, shape, Locked flag, and for Entries whether they are written as Given / When / Then.
import { type UseFormRegister } from 'react-hook-form'

import { inputCls } from '@/constants/TemplateEditorConstants'
import { cn } from '@/lib/cn'
import { type TemplateFormData } from '@/lib/formSchemas/templateSchema'

/** The Section's key, shape, Locked flag, and for Entries whether they are written as Given / When / Then. */
export function SectionOptions({
  index,
  register,
  isEntries,
}: Readonly<{ index: number; register: UseFormRegister<TemplateFormData>; isEntries: boolean }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm sm:col-span-3">
      <label className="flex items-center gap-1.5">
        <span className="text-ink-faint">Key</span>
        <input
          {...register(`sections.${index}.key`)}
          aria-label="Key"
          className={cn(inputCls, 'h-7 w-40 font-mono text-[13px]')}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-ink-faint">Shape</span>
        <select {...register(`sections.${index}.shape`)} className={cn(inputCls, 'h-7')}>
          <option value="prose">Prose</option>
          <option value="entries">Entries</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" className="accent-claude" {...register(`sections.${index}.locked`)} /> Locked
      </label>
      {isEntries && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-claude" {...register(`sections.${index}.gherkin`)} /> Entries are
          Given / When / Then
        </label>
      )}
    </div>
  )
}
