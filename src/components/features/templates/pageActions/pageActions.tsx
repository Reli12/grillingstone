// Import (through a hidden file input), export of the ticked Templates, and New Template.
import { type ChangeEvent, useRef } from 'react'
import { Link } from 'react-router'

import { Download, Plus, Upload } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

interface PageActionsProps {
  selectedCount: number
  exporting: boolean
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: () => void
}

/** Import (through a hidden file input), export of the ticked Templates, and New Template. */
export function PageActions({ selectedCount, exporting, onImportFile, onExport }: Readonly<PageActionsProps>) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        <Upload size={15} /> Import bundle
      </Button>
      <Button variant="outline" disabled={selectedCount === 0 || exporting} onClick={onExport}>
        <Download size={15} /> Export {selectedCount ? `${selectedCount} ` : ''}selected
      </Button>
      <Link to={routesPaths.newTemplate}>
        <Button variant="ink" tabIndex={-1}>
          <Plus size={15} /> New Template
        </Button>
      </Link>
    </>
  )
}
