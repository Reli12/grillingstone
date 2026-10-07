// Types shared by the Template editor's form parts.
import { type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { type TemplateFormData } from '@/lib/formSchemas/templateSchema'

export type SectionFormData = TemplateFormData['sections'][number]

export interface FormPartProps {
  register: UseFormRegister<TemplateFormData>
  errors: FieldErrors<TemplateFormData>
  readOnly: boolean
}
