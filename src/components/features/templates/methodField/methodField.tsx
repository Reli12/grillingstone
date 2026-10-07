// Template editor: the method Claude follows, as Markdown.
import { type UseFormRegister } from 'react-hook-form'

import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { type TemplateFormData } from '@/lib/formSchemas/templateSchema'

interface MethodFieldProps {
  register: UseFormRegister<TemplateFormData>
  readOnly: boolean
  error?: string
}

export function MethodField({ register, readOnly, error }: Readonly<MethodFieldProps>) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold">Writing method</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The instructions Claude follows for content, in markdown. They travel with the Template when you share it.
      </p>
      <textarea
        {...register('method')}
        disabled={readOnly}
        rows={22}
        aria-label="Writing method"
        className="mt-3 w-full rounded-md border border-line bg-sheet px-4 py-3 font-mono text-[13px] leading-6 focus:border-claude focus:outline-none disabled:bg-fog/60 disabled:text-ink-soft"
      />
      <FieldError message={error} />
    </section>
  )
}
