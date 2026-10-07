// Stands in for the title while the name field is still empty.
import { type ReactNode } from 'react'
import { type UseFormRegister } from 'react-hook-form'

import { parseGlossary, startingGlossary } from '#core/glossary/glossary.ts'

import { RecognisedTerms } from '@/components/features/projects/recognisedTerms/recognisedTerms'
import { type NewProjectFormData } from '@/lib/formSchemas/projectSchema'
import type { Source } from '@/types/project'

/** Stands in for the title while the name field is still empty. */
const NAME_PLACEHOLDER = 'Project name'

const PASTE_PLACEHOLDER = 'Paste your glossary here, in any format. A # Title line is replaced by the Project name.'

interface GlossaryPreviewProps {
  source: Exclude<Source, 'empty'>
  name: string
  body: string
  register: UseFormRegister<NewProjectFormData>
  /** The source's own control: an upload button for pasted text, a Project picker for a copy. */
  sourceControl: ReactNode
}

/** The starting Glossary as it will be saved: the Project name as its title, then the editable body. */
export function GlossaryPreview({ source, name, body, register, sourceControl }: Readonly<GlossaryPreviewProps>) {
  const terms = parseGlossary(startingGlossary(name || NAME_PLACEHOLDER, body))
  return (
    <>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Preview</p>
        <span className="ml-auto" />
        {sourceControl}
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-fog/40 focus-within:border-claude">
        <p
          className="border-b border-line-soft px-3 py-1.5 font-mono text-[13px] text-ink-soft"
          title="Always the Project name"
        >
          # {name.trim() || NAME_PLACEHOLDER}
        </p>
        <textarea
          {...register('body')}
          rows={14}
          placeholder={source === 'paste' ? PASTE_PLACEHOLDER : ''}
          aria-label="Starting Glossary"
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed focus:outline-none"
        />
      </div>
      {body.trim() && <RecognisedTerms terms={terms} />}
    </>
  )
}
