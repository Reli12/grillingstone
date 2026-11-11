// A Backlog Copy as it is now, read-only: what the Copy says, where it came from and which Drafts reference it.
// Changing it is a re-paste, offered from here.
import { RefreshCw } from 'lucide-react'

import { backlogCopyHeading } from '#core/backlog/backlogCopy.ts'
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { ExternalLink } from '@/components/atoms/externalLink/externalLink'
import { RichText } from '@/components/atoms/richText/richText'
import { Dialog } from '@/components/composite/dialog/dialog'
import { cn } from '@/lib/cn'

interface ViewCopyDialogProps {
  summary: BacklogCopySummary
  onClose: () => void
  onRepaste: () => void
}

// A markdown heading line ("## Business rules"), capturing its text.
const HEADING = /^#{1,6}\s+(.+)$/

type CopyPart = { kind: 'heading'; text: string } | { kind: 'text'; text: string }

/**
 * The Copy's text split at its headings. Headings are rendered here, for the preview only: the shared markdown
 * renderer is also what Publish writes to Azure DevOps, so it is left as it is.
 */
export function copyParts(text: string): CopyPart[] {
  const parts: CopyPart[] = []
  let lines: string[] = []
  const flush = () => {
    if (lines.some((line) => line.trim())) parts.push({ kind: 'text', text: lines.join('\n') })
    lines = []
  }
  for (const line of text.split(/\r?\n/)) {
    const heading = HEADING.exec(line.trim())?.[1]
    if (heading === undefined) {
      lines.push(line)
      continue
    }
    flush()
    parts.push({ kind: 'heading', text: heading.trim() })
  }
  flush()
  return parts
}

/** The Copy's text formatted: headings, paragraphs, lists, tables, bold, code and links. Never edited here. */
function CopyText({ heading, text }: Readonly<{ heading: string; text: string }>) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">{heading}</h3>
      <div className="space-y-2 rounded-md bg-fog px-3.5 py-3 font-serif text-[15px] leading-7 break-words">
        {copyParts(text).map((part, index) =>
          part.kind === 'heading' ? (
            <h4 key={index} className="pt-1 font-sans text-[14px] font-semibold text-ink">
              {part.text}
            </h4>
          ) : (
            <RichText key={index} text={part.text} className="[&_code]:bg-sheet [&_th]:bg-sheet" />
          ),
        )}
      </div>
    </section>
  )
}

/** Mounted only while open. */
export function ViewCopyDialog({ summary, onClose, onRepaste }: Readonly<ViewCopyDialogProps>) {
  const { copy, drafts } = summary
  return (
    <Dialog
      open
      onClose={onClose}
      title={backlogCopyHeading(copy)}
      className="w-[min(760px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onRepaste}>
            <RefreshCw size={14} /> Re-paste
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-faint">
          <span>
            Revision {copy.revision}, pasted {new Date(copy.pastedAt).toLocaleString()}
          </span>
          {copy.url && (
            <>
              <span aria-hidden>·</span>
              <ExternalLink href={copy.url}>Open in Azure DevOps</ExternalLink>
            </>
          )}
        </p>
        <CopyText heading="Description" text={copy.content} />
        {copy.acceptanceCriteria && <CopyText heading="Acceptance Criteria" text={copy.acceptanceCriteria} />}
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">Referenced by</h3>
          {drafts.length === 0 && <p className="text-sm text-ink-faint">No Draft references it yet.</p>}
          <ul className="space-y-0.5 text-sm">
            {drafts.map((draft) => (
              <li key={draft.id} className={cn(draft.changed ? 'text-redpencil' : 'text-ink-soft')}>
                {draft.title || draft.requirement || 'Not written yet'}
                {draft.changed && <span className="ml-1.5 font-medium">· changed since its last session</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  )
}
