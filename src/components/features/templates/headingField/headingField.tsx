// Template editor: a Section's heading input.
import { type ChangeEvent } from 'react'
import { type UseFormRegister } from 'react-hook-form'

import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { inputCls } from '@/constants/TemplateEditorConstants'
import { cn } from '@/lib/cn'
import { type TemplateFormData } from '@/lib/formSchemas/templateSchema'

interface HeadingFieldProps {
  index: number
  register: UseFormRegister<TemplateFormData>
  error?: string
  onChange: (heading: string) => void
}

export function HeadingField({ index, register, error, onChange }: Readonly<HeadingFieldProps>) {
  return (
    <div>
      <input
        {...register(`sections.${index}.heading`, {
          onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
        })}
        aria-label="Heading"
        placeholder="Heading"
        className={cn(inputCls, 'w-full font-serif font-semibold')}
      />
      <FieldError message={error} />
    </div>
  )
}
