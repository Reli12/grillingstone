// Shown on a Default: it can't be edited, but a "My …" copy can.
import { useNavigate } from 'react-router'

import { Copy } from 'lucide-react'

import type { Template } from '#core/template/templateTypes.ts'

import { useCreateTemplate } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { DEFAULT_NAME_PREFIX } from '@/constants/TemplateConstants'
import { routesPaths } from '@/routes/routes'

/** Shown on a Default: it can't be edited, but a "My …" copy can. */
export function DuplicateBanner({ template }: Readonly<{ template: Template }>) {
  const navigate = useNavigate()
  const duplicate = useCreateTemplate()
  const onDuplicate = () =>
    duplicate.mutate(
      { ...template, name: template.name.replace(DEFAULT_NAME_PREFIX, 'My ') },
      { onSuccess: (copy) => void navigate(routesPaths.template(copy.id)) },
    )
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-sheet px-4 py-3 text-sm">
      <span className="flex-1 text-ink-soft">
        Default Templates can’t be changed. Duplicate it to make your own version.
      </span>
      <Button variant="ink" size="sm" onClick={onDuplicate}>
        <Copy size={14} /> Duplicate to customise
      </Button>
    </div>
  )
}
