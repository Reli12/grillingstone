// Template editor: name, Work Item Type and Iteration Log fields.
import { type ReactNode } from 'react'

import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { inputCls } from '@/constants/TemplateEditorConstants'
import { cn } from '@/lib/cn'
import type { FormPartProps } from '@/types/templateForm'

interface GeneralFieldsProps extends FormPartProps {
  targetOptions: ReactNode
}

export function GeneralFields({ register, errors, readOnly, targetOptions }: Readonly<GeneralFieldsProps>) {
  return (
    <fieldset disabled={readOnly} className="mt-8 grid gap-5 sm:grid-cols-2">
      <div>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <TextInput id="name" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <FieldLabel htmlFor="log">Iteration Log heading</FieldLabel>
        <TextInput id="log" {...register('iterationLogHeading')} />
        <FieldError message={errors.iterationLogHeading?.message} />
      </div>
      <div>
        <FieldLabel htmlFor="logTarget">Iteration Log field</FieldLabel>
        <select id="logTarget" {...register('iterationLogTarget')} className={cn(inputCls, 'w-full')}>
          {targetOptions}
        </select>
        <FieldError message={errors.iterationLogTarget?.message} />
      </div>
    </fieldset>
  )
}
