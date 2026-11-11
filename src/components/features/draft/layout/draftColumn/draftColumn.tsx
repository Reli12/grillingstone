// From v1 on: the chat (or Glossary) on the left, the live Draft on the right.
import { BacklogChangedBanner } from '@/components/features/draft/layout/backlogChangedBanner/backlogChangedBanner'
import { DraftToolbar } from '@/components/features/draft/layout/draftToolbar/draftToolbar'
import { DriftBanner } from '@/components/features/draft/layout/driftBanner/driftBanner'
import { UpgradeBanner } from '@/components/features/draft/layout/upgradeBanner/upgradeBanner'
import { ProposalBar } from '@/components/features/draft/proposal/proposalBar/proposalBar'
import { DraftSheet } from '@/components/features/draft/sheet/draftSheet/draftSheet'
import { DiscardedVisibilityContext } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDiscardedVisibilityValue } from '@/hooks/draft/useDiscardedVisibilityValue'
import { cn } from '@/lib/cn'
import type { DraftWorkspaceLayoutProps } from '@/types/draftPage'

/** From v1 on: the chat (or Glossary) on the left, the live Draft on the right. */
/** The right column: the toolbar, the upgrade offer, the open Proposal's bar, and the Draft sheet. */
export function DraftColumn({
  projectId,
  projectName,
  draft,
  live,
  ui,
  upgradeTo,
  busy,
  onAcceptClean,
}: Readonly<Omit<DraftWorkspaceLayoutProps, 'dialogs' | 'chat'>>) {
  const running = !!live
  const discardedVisibility = useDiscardedVisibilityValue()
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto bg-sheet lg:block', ui.mobileView === 'draft' ? 'block' : 'hidden')}
    >
      <DiscardedVisibilityContext.Provider value={discardedVisibility}>
        <div className="px-4 pb-16 sm:px-10">
          <DraftToolbar
            projectId={projectId}
            projectName={projectName}
            draft={draft}
            running={running}
            onReferences={() => ui.setRefsOpen(true)}
            onDelete={() => ui.setDeleteOpen(true)}
            onCopy={() => ui.setCopyOpen(true)}
            onPublish={() => ui.setPublishOpen(true)}
          />
          {upgradeTo && (
            <UpgradeBanner latest={upgradeTo} draft={draft} onUpgrade={() => ui.setIntent({ kind: 'upgrade' })} />
          )}
          <BacklogChangedBanner draft={draft} />
          <DriftBanner draft={draft} />
          {draft.proposal && <ProposalBar proposal={draft.proposal} busy={busy} onAcceptClean={onAcceptClean} />}
          <div className="pt-6">
            <DraftSheet />
          </div>
        </div>
      </DiscardedVisibilityContext.Provider>
    </div>
  )
}
