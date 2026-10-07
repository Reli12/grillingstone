// The Draft page from v1 on: chat or Glossary on the left, the live Draft on the right (tabs on mobile).
import { DraftColumn } from '@/components/features/draft/layout/draftColumn/draftColumn'
import { MobileTabs } from '@/components/features/draft/layout/mobileTabs/mobileTabs'
import { SidePanel } from '@/components/features/draft/layout/sidePanel/sidePanel'
import type { FromV1LayoutProps } from '@/types/draftPage'

export function FromV1Layout(props: Readonly<Omit<FromV1LayoutProps, 'dialogs'>>) {
  const { projectId, live, ui, chat } = props
  const running = !!live
  return (
    <div className="flex h-full flex-col lg:grid lg:grid-cols-[minmax(360px,440px)_1fr]">
      <MobileTabs view={ui.mobileView} running={running} onChange={ui.setMobileView} />
      <SidePanel
        projectId={projectId}
        side={ui.side}
        visible={ui.mobileView === 'chat'}
        running={running}
        chat={chat}
        onSideChange={ui.setSide}
      />
      <DraftColumn {...props} />
    </div>
  )
}
