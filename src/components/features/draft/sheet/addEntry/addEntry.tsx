// "Add Entry" under a Section: a button that opens the new-Entry form in place.
import { useState } from 'react'

import { Plus } from 'lucide-react'

import type { Section } from '#core/draft/draftTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { AddEntryForm } from '@/components/features/draft/sheet/addEntryForm/addEntryForm'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

interface AddEntryProps {
  section: Section
}

export function AddEntry({ section }: Readonly<AddEntryProps>) {
  const { apply } = useDraftEditor()
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <Button size="sm" variant="quiet" className="mt-1 ml-5" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add Entry
      </Button>
    )
  return (
    <div className="mt-2 ml-6">
      <AddEntryForm
        onCancel={() => setOpen(false)}
        onSave={(title, body) => {
          apply({ op: 'addEntry', sectionId: section.id, title, body })
          setOpen(false)
        }}
      />
    </div>
  )
}
