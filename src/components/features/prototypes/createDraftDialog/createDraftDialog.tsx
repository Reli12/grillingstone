// Create Draft… on a Prototype: the New Draft form in a dialog.
import { useProject } from '@/api/hooks/projects/projectHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { Dialog } from '@/components/composite/dialog/dialog'
import { CreateDraftFields } from '@/components/features/prototypes/createDraftFields/createDraftFields'

interface CreateDraftDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  prototypeId: string
}

/** The Draft creation form in a dialog; the Prototype is recorded on the Draft and given to its first session. */
export function CreateDraftDialog({ open, onClose, projectId, prototypeId }: Readonly<CreateDraftDialogProps>) {
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  return (
    <Dialog open={open} onClose={onClose} title="Create Draft from this Prototype">
      {project && templates ? (
        <CreateDraftFields project={project} templates={templates} prototypeId={prototypeId} onCancel={onClose} />
      ) : (
        <p className="text-sm text-ink-soft">Loading…</p>
      )}
    </Dialog>
  )
}
