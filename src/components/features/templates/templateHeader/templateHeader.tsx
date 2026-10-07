// Template editor header: breadcrumbs, name and where the Template came from.
import { Link } from 'react-router'

import type { Template } from '#core/template/templateTypes.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { routesPaths } from '@/routes/routes'

export function TemplateHeader({ template }: Readonly<{ template: Template }>) {
  const { origin } = template
  return (
    <>
      <Link to={routesPaths.templates} className="text-sm text-ink-faint hover:text-ink">
        Templates
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-[28px] leading-tight font-semibold tracking-tight">{template.name}</h1>
        <Tag>
          {template.workItemType}, v{template.version}
        </Tag>
        {template.isDefault && <Tag tone="ink">Default, read-only</Tag>}
      </div>
      {origin && (
        <p className="mt-2 text-sm text-ink-soft">
          Made in a Template Session on{' '}
          {new Date(origin.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.{' '}
          <Link to={routesPaths.templateSession(origin.sessionId)} className="text-claude underline">
            Read the transcript
          </Link>
        </p>
      )}
    </>
  )
}
