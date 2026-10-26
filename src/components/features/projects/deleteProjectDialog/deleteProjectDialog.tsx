// Asks before a Project is deleted, says that everything in it goes, and shows why the backend refused.
import type { ProjectSummary } from '#core/contract/apiTypes.ts'

import { useDeleteProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { Dialog } from '@/components/composite/dialog/dialog'
import { forgetProject } from '@/lib/lastProject'

interface DeleteProjectDialogProps {
  project: ProjectSummary
  onClose: () => void
}

/** Mounted only while open; give it the Project's id as its key so a refusal never carries over to another. */
export function DeleteProjectDialog({ project, onClose }: Readonly<DeleteProjectDialogProps>) {
  const remove = useDeleteProject()
  const onDelete = () =>
    remove.mutate(project.id, {
      onSuccess: () => {
        forgetProject(project.id)
        onClose()
      },
    })
  const drafts = `${project.drafts} Draft${project.drafts === 1 ? '' : 's'}`
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete “${project.name}”?`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
            Delete Project
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        The Project goes with its {drafts}, their Transcripts and Images, and its Glossary. This can’t be undone.
      </p>
      <FieldError message={remove.error?.message} />
    </Dialog>
  )
}
