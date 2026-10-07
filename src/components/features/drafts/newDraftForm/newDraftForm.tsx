// The New Draft form: the requirement, Work Item Type, Template and References for a Draft.
import { Link } from 'react-router'

import type { DraftSummary, Project } from '#core/contract/apiTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { TextArea } from '@/components/atoms/textArea/textArea'
import { DraftTypePicker } from '@/components/features/drafts/draftTypePicker/draftTypePicker'
import { ReferencePicker } from '@/components/features/drafts/referencePicker/referencePicker'
import { StartButton } from '@/components/features/drafts/startButton/startButton'
import { TemplatePicker } from '@/components/features/drafts/templatePicker/templatePicker'
import { useNewDraftForm } from '@/hooks/drafts/useNewDraftForm'
import { routesPaths } from '@/routes/routes'

interface NewDraftFormProps {
  project: Project
  templates: Template[]
  /** The Project's Drafts; written ones can be referenced. */
  drafts: DraftSummary[]
}

/** Requirement, Work Item Type, Template and References for a new Draft; submitting starts the first session. */
export function NewDraftForm({ project, templates, drafts }: Readonly<NewDraftFormProps>) {
  const form = useNewDraftForm(project, templates)
  const referable = drafts.filter((draft) => draft.version > 0)

  return (
    <form className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]" onSubmit={form.onSubmit}>
      <section>
        <Link to={routesPaths.project(project.id)} className="text-sm text-ink-faint hover:text-ink">
          {project.name}
        </Link>
        <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold tracking-tight">
          What do you want to grill?
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Describe the requirement in your own words — a sentence is enough. Paste the BA’s Feature text or business
          rules if you have them.
        </p>
        <TextArea
          autoFocus
          minRows={9}
          {...form.register('requirement')}
          placeholder="Managers need to archive devices so they stop cluttering dashboards…"
          aria-label="Requirement"
          className="mt-5 font-serif text-[16px] leading-7"
        />
        {referable.length > 0 && (
          <ReferencePicker referable={referable} references={form.references} onToggle={form.toggleReference} />
        )}
      </section>

      <aside className="space-y-7 md:pt-12">
        <DraftTypePicker type={form.type} onChoose={form.chooseType} />
        <TemplatePicker
          templates={form.forType}
          chosenId={form.chosen?.id}
          onChoose={(templateId) => form.setValue('templateId', templateId)}
        />
        <StartButton disabled={!form.canStart} starting={form.create.isPending} />
      </aside>
    </form>
  )
}
