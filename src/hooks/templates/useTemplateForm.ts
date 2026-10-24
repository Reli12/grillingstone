// The editor's form: its fields, the Sections array, and save (which resets to the saved version).
import { useFieldArray, useForm, useWatch } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { customFieldName, isCustomFieldTarget, type SectionTarget } from '#core/shared/trackerFields.ts'
import { defaultIterationLogTarget } from '#core/shared/workItemType.ts'
import { type Template, templateTracker } from '#core/template/templateTypes.ts'

import { useUpdateTemplate } from '@/api/hooks/templates/templateHooks'
import { type TemplateFormData, templateSchema } from '@/lib/formSchemas/templateSchema'

const NON_ALPHANUMERIC_RUN = /[^A-Za-z0-9 ]+/g // punctuation and symbols, which a key can't hold
const WHITESPACE_RUN = /\s+/ // the gaps between words
const PLACEHOLDER_KEY = /^section\d*$/ // the "section", "section3"… keys a new Section starts with

/** The Custom Fields a Template already uses, each once, in the order they first appear. */
function customFieldsOf(targets: string[]): string[] {
  const names = targets.filter(isCustomFieldTarget).map(customFieldName)
  return [...new Set(names)]
}

export function toForm(template: Template): TemplateFormData {
  const tracker = templateTracker(template)
  const iterationLogTarget = template.iterationLogTarget ?? defaultIterationLogTarget(tracker, template.workItemType)
  const targets = [...template.sections.map((section) => section.target), iterationLogTarget]
  return {
    name: template.name,
    tracker,
    workItemType: template.workItemType,
    iterationLogHeading: template.iterationLogHeading,
    iterationLogTarget,
    customFields: customFieldsOf(targets),
    method: template.method,
    sections: template.sections.map((section) => ({
      key: section.key,
      heading: section.heading,
      shape: section.shape,
      locked: section.locked,
      guidance: section.guidance,
      target: section.target,
      gherkin: section.entryFormat === 'gherkin',
    })),
  }
}

/**
 * The form's Sections back into Template Sections; the Gherkin flag only means something for Entries. The
 * schema has already checked every target against the Template's Tracker; Custom Fields live on in them.
 */
const fromForm = (base: Template, form: TemplateFormData): Template => ({
  ...base,
  name: form.name,
  iterationLogHeading: form.iterationLogHeading,
  iterationLogTarget: form.iterationLogTarget as SectionTarget,
  method: form.method,
  sections: form.sections.map(({ gherkin, target, ...section }) => ({
    ...section,
    target: target as SectionTarget,
    ...(gherkin && section.shape === 'entries' ? { entryFormat: 'gherkin' as const } : {}),
  })),
})

const capitalised = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase()

/** A camelCase key from a heading: "Acceptance criteria!" becomes "acceptanceCriteria". */
const keyFrom = (heading: string) =>
  heading
    .replace(NON_ALPHANUMERIC_RUN, ' ')
    .trim()
    .split(WHITESPACE_RUN)
    .map((word, i) => (i === 0 ? word.toLowerCase() : capitalised(word)))
    .join('')

/** The editor's form: its fields, the Sections array, and save (which resets to the saved version). */
export function useTemplateForm(template: Template) {
  const update = useUpdateTemplate()
  const form = useForm<TemplateFormData>({ resolver: zodResolver(templateSchema), defaultValues: toForm(template) })
  const sectionArray = useFieldArray({ control: form.control, name: 'sections' })
  const sections = useWatch({ control: form.control, name: 'sections' })

  const onSave = form.handleSubmit((values) =>
    update.mutate(fromForm(template, values), {
      onSuccess: (saved) => {
        form.reset(toForm(saved))
        toast.success(`Saved as v${saved.version}. New Drafts use it; existing Drafts can upgrade.`)
      },
    }),
  )

  // A new Section's key follows its heading until it has been saved under a real name.
  const followHeading = (index: number, heading: string) => {
    const key = sections[index]?.key
    const unsaved = !key || PLACEHOLDER_KEY.test(key) || !template.sections.some((saved) => saved.key === key)
    if (unsaved) form.setValue(`sections.${index}.key`, keyFrom(heading) || 'section')
  }
  return { form, sectionArray, sections, onSave, saving: update.isPending, followHeading }
}
