// New Project: the note shown when the Glossary starts empty.
import { BookOpenText } from 'lucide-react'

export function EmptyGlossaryNote() {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-md border border-dashed border-line p-4 text-center text-sm text-ink-faint">
      <BookOpenText size={22} className="mb-2" />
      An empty Glossary. You can edit it any time from the Project page.
    </div>
  )
}
