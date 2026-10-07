// The dialog's right side: a note for an empty Glossary, else the preview with its source's control.
import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { CopySourceSelect } from '@/components/features/projects/copySourceSelect/copySourceSelect'
import { EmptyGlossaryNote } from '@/components/features/projects/emptyGlossaryNote/emptyGlossaryNote'
import { GlossaryPreview } from '@/components/features/projects/glossaryPreview/glossaryPreview'
import { UploadButton } from '@/components/features/projects/uploadButton/uploadButton'
import type { useCreateProjectForm } from '@/hooks/projects/useCreateProjectForm'

interface GlossaryStartProps {
  form: ReturnType<typeof useCreateProjectForm>
  projects: ProjectSummary[]
}

/** The dialog's right side: a note for an empty Glossary, else the preview with its source's control. */
export function GlossaryStart({ form, projects }: Readonly<GlossaryStartProps>) {
  const { source } = form
  if (source === 'empty') return <EmptyGlossaryNote />
  const sourceControl =
    source === 'paste' ? (
      <UploadButton onText={form.setBody} />
    ) : (
      <CopySourceSelect
        projects={projects}
        copyFrom={form.copyFrom}
        onCopy={(projectId) => void form.copy(projectId)}
      />
    )
  return (
    <GlossaryPreview
      source={source}
      name={form.name}
      body={form.body}
      register={form.register}
      sourceControl={sourceControl}
    />
  )
}
