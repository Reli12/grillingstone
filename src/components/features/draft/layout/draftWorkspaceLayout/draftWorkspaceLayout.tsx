// The Draft page from v1 on: chat or Glossary on the left, the live Draft on the right (tabs on mobile).
import { DraftColumn } from '@/components/features/draft/layout/draftColumn/draftColumn'
import { MobileTabs } from '@/components/features/draft/layout/mobileTabs/mobileTabs'
import { SidePanel } from '@/components/features/draft/layout/sidePanel/sidePanel'
import { cn } from '@/lib/cn'
import type { DraftWorkspaceLayoutProps } from '@/types/draftPage'

/** Desktop columns: the side panel at its normal width, or widened to about 60% beside the Draft. */
const NORMAL_COLUMNS = 'lg:grid-cols-[minmax(360px,440px)_1fr]'
const WIDE_COLUMNS = 'lg:grid-cols-[minmax(360px,3fr)_2fr]'

export function DraftWorkspaceLayout(props: Readonly<Omit<DraftWorkspaceLayoutProps, 'dialogs'>>) {
  const { projectId, draft, live, ui, chat } = props
  const running = !!live
  return (
    <div className={cn('flex h-full flex-col lg:grid', ui.wide ? WIDE_COLUMNS : NORMAL_COLUMNS)}>
      <MobileTabs view={ui.mobileView} running={running} onChange={ui.setMobileView} />
      <SidePanel
        projectId={projectId}
        draftId={draft.id}
        side={ui.side}
        visible={ui.mobileView === 'chat'}
        running={running}
        wide={ui.wide}
        chat={chat}
        onSideChange={ui.setSide}
        onWideChange={ui.setWide}
      />
      <DraftColumn {...props} />
    </div>
  )
}
