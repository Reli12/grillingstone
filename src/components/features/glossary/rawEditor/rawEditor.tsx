// The whole CONTEXT.md as one text box, for edits the term list can't express.
import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'

interface RawEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  onSave: () => void
  onCancel: () => void
}

/** The whole CONTEXT.md as one text box, for edits the term list can't express. */
export function RawEditor({ markdown, onChange, onSave, onCancel }: Readonly<RawEditorProps>) {
  return (
    <div className="space-y-2">
      <TextArea
        minRows={14}
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono text-[13px]"
        aria-label="CONTEXT.md"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ink" onClick={onSave}>
          Save CONTEXT.md
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
