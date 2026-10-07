// Templates page: one Template row with select, Duplicate and open.
import { Link } from 'react-router'

import { Copy } from 'lucide-react'

import type { Template } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { Tag } from '@/components/atoms/tag/tag'
import { routesPaths } from '@/routes/routes'

interface TemplateRowProps {
  template: Template
  selected: boolean
  duplicating: boolean
  onToggle: () => void
  onDuplicate: () => void
}

export function TemplateRow({ template, selected, duplicating, onToggle, onDuplicate }: Readonly<TemplateRowProps>) {
  const sectionCount = template.sections.length
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <input
        type="checkbox"
        className="accent-claude"
        aria-label={`Select ${template.name} for export`}
        checked={selected}
        onChange={onToggle}
      />
      <Link to={routesPaths.template(template.id)} className="min-w-0 flex-1 hover:underline">
        <span className="font-medium">{template.name}</span>
        <span className="ml-2 text-[13px] text-ink-faint">
          v{template.version}, {sectionCount} Section{sectionCount === 1 ? '' : 's'}
        </span>
      </Link>
      {template.isDefault && <Tag>Default, read-only</Tag>}
      <Button size="sm" variant="quiet" onClick={onDuplicate} disabled={duplicating}>
        <Copy size={14} /> Duplicate
      </Button>
    </li>
  )
}
