// New Template: the header and the purpose field.
import { type UseFormRegister } from 'react-hook-form'
import { Link } from 'react-router'

import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { type NewTemplateFormData } from '@/lib/formSchemas/newTemplateSchema'
import { routesPaths } from '@/routes/routes'

export function PurposeSection({ register }: Readonly<{ register: UseFormRegister<NewTemplateFormData> }>) {
  const assistant = useAssistantLabel()
  return (
    <section>
      <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
        Templates
      </Link>
      <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">
        What is this Template for?
      </h1>
      <p className="mt-2 max-w-lg text-ink-soft">
        Describe the kind of work item and who reads it. {assistant} grills this into Sections and a writing method — or
        it seeds the Purpose if you build it yourself.
      </p>
      <TextArea
        autoFocus
        minRows={6}
        {...register('purpose')}
        placeholder="Spike PBIs: timeboxed investigations that end in a written recommendation instead of shipped code…"
        aria-label="What the Template is for"
        className="mt-5 font-serif text-[16px] leading-7"
      />

      <div className="mt-6">
        <FieldLabel
          htmlFor="examples"
          hint={`Paste one or more real work items written the way you like. ${assistant} learns the house style from them. Leave out client names — Templates are shared.`}
        >
          Example work items (optional)
        </FieldLabel>
        <TextArea id="examples" minRows={5} {...register('examples')} className="font-serif text-[15px] leading-7" />
      </div>
    </section>
  )
}
