// Template editor: the name box and Add button for a new Custom Field. Enter adds it instead of saving.
import { useState } from 'react'

import { Plus } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'

export function AddCustomField({ onAdd }: Readonly<{ onAdd: (name: string) => void }>) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
  }
  return (
    <div className="mt-2 flex gap-2">
      <TextInput
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          // Enter adds the field instead of submitting the whole Template.
          event.preventDefault()
          add()
        }}
        placeholder="e.g. Acceptance Criteria"
        aria-label="New Custom Field name"
      />
      <Button onClick={add} disabled={!name.trim()}>
        <Plus size={14} /> Add
      </Button>
    </div>
  )
}
