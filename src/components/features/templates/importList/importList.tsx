// Each Template in the bundle with its status; identical ones can't be ticked, there is nothing to import.
import type { ImportItem, ImportStatus } from '#core/template/templateBundle.ts'

import { Tag } from '@/components/atoms/tag/tag'

const STATUS: Record<ImportStatus, { tone: 'proof' | 'mark' | 'neutral'; text: string }> = {
  new: { tone: 'proof', text: 'New' },
  changed: { tone: 'mark', text: 'Changed' },
  identical: { tone: 'neutral', text: 'Identical' },
}

interface ImportListProps {
  items: ImportItem[]
  selected: Set<number>
  onToggle: (index: number) => void
}

/** Each Template in the bundle with its status; identical ones can't be ticked, there is nothing to import. */
export function ImportList({ items, selected, onToggle }: Readonly<ImportListProps>) {
  return (
    <>
      <p className="mb-3 text-sm text-ink-soft">
        Changed Templates of yours are replaced only if you tick them; a changed Default arrives as a copy. Nothing you
        have is deleted.
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
              <input
                type="checkbox"
                className="accent-claude"
                disabled={item.status === 'identical'}
                checked={selected.has(i)}
                onChange={() => onToggle(i)}
              />
              <span className="w-14 text-ink-faint">{item.template.workItemType}</span>
              <span className="flex-1 font-medium">{item.template.name}</span>
              <Tag tone={STATUS[item.status].tone}>{STATUS[item.status].text}</Tag>
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}
