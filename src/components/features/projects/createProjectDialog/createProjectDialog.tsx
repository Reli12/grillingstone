// The New Project dialog: a name, and where the Project's Glossary starts from.

import { useProjects } from '@/api/hooks/projects/projectHooks'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { CreateProjectActions } from '@/components/features/projects/createProjectActions/createProjectActions'
import { GlossaryStart } from '@/components/features/projects/glossaryStart/glossaryStart'
import { SourceChoices } from '@/components/features/projects/sourceChoices/sourceChoices'
import { useCreateProjectForm } from '@/hooks/projects/useCreateProjectForm'

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Names a new Project and chooses how its Glossary starts: empty, from text the human brings, or as a copy of
 * another Project's. The copy is taken once; the title is always the new Project's name.
 */
export function CreateProjectDialog({ open, onClose }: Readonly<CreateProjectDialogProps>) {
  const { data: projects = [] } = useProjects()
  const form = useCreateProjectForm(open)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Project"
      className="w-[min(920px,calc(100vw-32px))]"
      footer={<CreateProjectActions canCreate={form.canCreate} onCancel={onClose} onCreate={form.onSubmit} />}
    >
      <form className="grid gap-5 md:grid-cols-[260px_1fr]" onSubmit={form.onSubmit}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Name</p>
            <TextInput
              {...form.register('name')}
              placeholder="e.g. Billing Platform"
              aria-label="Project name"
              autoFocus
            />
          </div>
          <SourceChoices current={form.source} offerCopy={projects.length > 0} onPick={form.pick} />
        </div>

        <div className="min-w-0 space-y-2">
          <GlossaryStart form={form} projects={projects} />
        </div>
      </form>
    </Dialog>
  )
}
