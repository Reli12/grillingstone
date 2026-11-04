// "Code this session reads" (ADR-0016): wherever a Grilling Session starts — the New Draft form, the Focused /
// Upgrade dialog and the idle message box — a table of the Project's Code Folders with their branch state and a
// Read / Don't read switch, Read by default. Folders off their default branch or with uncommitted changes are
// marked, missing ones are skipped; nothing here ever blocks starting. In the message box it is one line until
// the human asks to change it. Hidden when the Project has no Code Folders.
import { useState } from 'react'

import { FolderGit2, TriangleAlert } from 'lucide-react'

import type { CodeFolderState } from '#core/codeFolder/codeFolderTypes.ts'

import { useCodeFolderState } from '@/api/hooks/codeFolders/codeFolderHooks'
import { cn } from '@/lib/cn'

interface SessionCodeChoiceProps {
  projectId: string
  read: boolean
  onChange: (read: boolean) => void
  /** One line until expanded: for the message box. */
  compact?: boolean
  className?: string
}

/** Off the default branch, or carrying uncommitted changes: what Claude treats as possibly not yet true. */
const doubtful = (folder: CodeFolderState) => !folder.missing && (!folder.onDefaultBranch || folder.uncommitted > 0)

/** "app@main", "ui-lib@feature/x*" (* = uncommitted changes), "docs" outside git. */
function shortName(folder: CodeFolderState) {
  if (!folder.inGit) return folder.label
  return `${folder.label}@${folder.branch ?? folder.commit}${folder.uncommitted ? '*' : ''}`
}

function StateText({ folder }: Readonly<{ folder: CodeFolderState }>) {
  if (folder.missing) return <span className="text-redpencil">missing, skipped</span>
  if (!folder.inGit) return <span className="text-ink-faint">not in git</span>
  if (!doubtful(folder)) return <span className="text-proof">on default, clean</span>
  const parts = [
    folder.onDefaultBranch ? '' : `default is ${folder.defaultBranch}`,
    folder.uncommitted ? `${folder.uncommitted} uncommitted` : '',
  ].filter(Boolean)
  return <span className="text-mark-ink">{parts.join(' · ')}</span>
}

function ReadSwitch({ read, onChange }: Readonly<{ read: boolean; onChange: (read: boolean) => void }>) {
  return (
    <span className="flex rounded-md bg-fog-deep p-0.5 text-[12px]">
      {[true, false].map((value) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={read === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded px-2 py-0.5',
            read === value ? 'bg-sheet font-medium text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
          )}
        >
          {value ? 'Read' : 'Don’t read'}
        </button>
      ))}
    </span>
  )
}

function FullBlock({
  folders,
  read,
  onChange,
  onCollapse,
  className,
}: Readonly<{
  folders: CodeFolderState[]
  read: boolean
  onChange: (read: boolean) => void
  onCollapse?: () => void
  className?: string
}>) {
  const headingId = `code-choice-${folders[0].id}`
  return (
    <div role="group" aria-labelledby={headingId} className={cn('rounded-lg border border-line bg-sheet', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <span id={headingId} className="flex items-center gap-1.5 text-sm font-medium">
          <FolderGit2 size={15} aria-hidden /> Code this session reads
        </span>
        <span className="flex items-center gap-2">
          <ReadSwitch read={read} onChange={onChange} />
          {onCollapse && (
            <button type="button" className="text-[12px] text-ink-faint underline hover:text-ink" onClick={onCollapse}>
              collapse
            </button>
          )}
        </span>
      </div>
      <table className={cn('w-full text-[13px]', !read && 'opacity-40')}>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.id} className="border-b border-line-soft last:border-0">
              <td className="py-1.5 pl-3 font-mono font-medium">{folder.label}</td>
              <td className={cn('py-1.5 font-mono', !folder.missing && !folder.onDefaultBranch && 'text-mark-ink')}>
                {folder.missing || !folder.inGit ? '—' : (folder.branch ?? 'detached')}
              </td>
              <td className="py-1.5 font-mono text-ink-faint">{folder.commit}</td>
              <td className="py-1.5 pr-3 text-right">
                <StateText folder={folder} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {read && folders.some(doubtful) && (
        <p className="border-t border-line-soft px-3 py-1.5 text-[12px] text-ink-faint">
          Code marked yellow may not be true yet; Claude will say so when it relies on it. Switch branch first if you
          want the default one — starting is never blocked.
        </p>
      )}
    </div>
  )
}

export function SessionCodeChoice({
  projectId,
  read,
  onChange,
  compact = false,
  className,
}: Readonly<SessionCodeChoiceProps>) {
  const { data: folders } = useCodeFolderState(projectId)
  const [expanded, setExpanded] = useState(false)
  if (!folders?.length) return null
  if (compact && !expanded) {
    const readable = folders.filter((folder) => !folder.missing)
    return (
      <div className={cn('flex items-center gap-2 text-[13px] text-ink-soft', className)}>
        <FolderGit2 size={14} aria-hidden />
        <span className="truncate font-mono">
          {read ? `Reads ${readable.map(shortName).join(', ') || 'no code'}` : 'Reads no code'}
        </span>
        {read && folders.some((folder) => doubtful(folder) || folder.missing) && (
          <TriangleAlert size={13} className="shrink-0 text-mark-ink" aria-label="Some code may not be true yet" />
        )}
        <button type="button" className="underline hover:text-ink" onClick={() => setExpanded(true)}>
          change
        </button>
      </div>
    )
  }
  return (
    <FullBlock
      folders={folders}
      read={read}
      onChange={onChange}
      onCollapse={compact ? () => setExpanded(false) : undefined}
      className={className}
    />
  )
}
