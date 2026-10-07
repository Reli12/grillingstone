// Import dialog's Cancel and Import buttons.
import { Button } from '@/components/atoms/button/button'

interface ImportActionsProps {
  count: number
  canImport: boolean
  onCancel: () => void
  onImport: () => void
}

export function ImportActions({ count, canImport, onCancel, onImport }: Readonly<ImportActionsProps>) {
  return (
    <>
      <Button variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="ink" disabled={!canImport} onClick={onImport}>
        Import {count || ''}
      </Button>
    </>
  )
}
