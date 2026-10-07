// New Project dialog's Cancel and Create Project buttons.
import { Button } from '@/components/atoms/button/button'

interface CreateProjectActionsProps {
  canCreate: boolean
  onCancel: () => void
  onCreate: () => void
}

export function CreateProjectActions({ canCreate, onCancel, onCreate }: Readonly<CreateProjectActionsProps>) {
  return (
    <>
      <Button variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="ink" disabled={!canCreate} onClick={onCreate}>
        Create Project
      </Button>
    </>
  )
}
