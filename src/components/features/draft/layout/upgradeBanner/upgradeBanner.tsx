// Banner offering to upgrade a Draft to its Template's newer version.
import { Sparkles } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'

export function UpgradeBanner({
  latest,
  draft,
  onUpgrade,
}: Readonly<{ latest: Template; draft: Draft; onUpgrade: () => void }>) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-claude/30 bg-claude-wash px-4 py-2.5 text-sm">
      <Sparkles size={16} className="text-claude" />
      <span className="flex-1">
        {latest.name} is now at v{latest.version}; this Draft uses v{draft.template.version}.
      </span>
      <Button size="sm" variant="claude" onClick={onUpgrade}>
        Upgrade this Draft
      </Button>
    </div>
  )
}
