// The whole CONTEXT.md as one text box, for edits the term list can't express.
import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { SaveProblem } from '@/components/features/glossary/saveProblem/saveProblem'
import type { SaveStatus } from '@/types/glossary'

interface RawEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  onSave: () => void
  onCancel: () => void
  /** How the last save went; after a refused one, saving again overwrites the latest Glossary with this text. */
  status?: SaveStatus
}

const NO_PROBLEM: SaveStatus = { saving: false, stale: false, failure: null }

/** The whole CONTEXT.md as one text box, for edits the term list can't express. */
export function RawEditor({ markdown, onChange, onSave, onCancel, status = NO_PROBLEM }: Readonly<RawEditorProps>) {
  return (
    <div className="space-y-2">
      <TextArea
        minRows={14}
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono text-[13px]"
        aria-label="CONTEXT.md"
      />
      <SaveProblem status={status} staleHint="Save yours to replace it, or discard your text and reload." />
      <div className="flex gap-2">
        <Button size="sm" variant="ink" onClick={onSave} disabled={status.saving}>
          {status.stale ? 'Save mine anyway' : 'Save CONTEXT.md'}
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          {status.stale ? 'Discard and reload' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
