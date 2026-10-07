// Confirms deleting a Template; existing Drafts keep their copy.
import { useNavigate } from 'react-router'

import type { Template } from '#core/template/templateTypes.ts'

import { useDeleteTemplate } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { Dialog } from '@/components/composite/dialog/dialog'
import { routesPaths } from '@/routes/routes'

interface DeleteTemplateDialogProps {
  template: Template
  open: boolean
  onClose: () => void
}

export function DeleteTemplateDialog({ template, open, onClose }: Readonly<DeleteTemplateDialogProps>) {
  const navigate = useNavigate()
  const remove = useDeleteTemplate()
  const onDelete = () => remove.mutate(template.id, { onSuccess: () => void navigate(routesPaths.templates) })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${template.name}”?`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete Template
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">Drafts already written in it keep their own copy and stay valid.</p>
    </Dialog>
  )
}
