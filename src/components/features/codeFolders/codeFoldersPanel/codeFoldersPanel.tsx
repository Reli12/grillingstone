// The Project's Code Folders tab (ADR-0016): every linked folder with its path and current branch state, linking
// (inline), editing, unlinking, and each folder's exclusion preview.
import { Fragment, useState } from 'react'

import { Ban, ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react'

import type { CodeFolderState } from '#core/codeFolder/codeFolderTypes.ts'

import { useCodeFolderState, useRemoveCodeFolder } from '@/api/hooks/codeFolders/codeFolderHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { Tag } from '@/components/atoms/tag/tag'
import { EmptyState } from '@/components/composite/emptyState/emptyState'
import { EditCodeFolderForm, LinkCodeFolderForm } from '@/components/features/codeFolders/codeFolderForm/codeFolderForm'
import { ExclusionPreview } from '@/components/features/codeFolders/exclusionPreview/exclusionPreview'
import { cn } from '@/lib/cn'

const COLUMNS = 6

function BranchCell({ folder }: Readonly<{ folder: CodeFolderState }>) {
  if (folder.missing) return <span className="text-ink-faint">—</span>
  if (!folder.inGit) return <span className="text-ink-faint">not in git</span>
  return (
    <span className="font-mono text-[13px]">
      <span className={cn(!folder.onDefaultBranch && 'text-mark-ink')}>{folder.branch ?? 'detached'}</span>{' '}
      <span className="text-ink-faint">{folder.commit}</span>
    </span>
  )
}

function StateTags({ folder }: Readonly<{ folder: CodeFolderState }>) {
  if (folder.missing) return <Tag tone="redpencil">Missing — skipped</Tag>
  const clean = folder.onDefaultBranch && !folder.uncommitted
  return (
    <span className="flex flex-wrap gap-1">
      {!folder.onDefaultBranch && <Tag tone="mark">Not {folder.defaultBranch}</Tag>}
      {folder.uncommitted > 0 && <Tag tone="mark">{folder.uncommitted} uncommitted</Tag>}
      {clean && <Tag tone="proof">{folder.inGit ? 'Clean' : 'No git'}</Tag>}
    </span>
  )
}

function FolderRow({ projectId, folder }: Readonly<{ projectId: string; folder: CodeFolderState }>) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const remove = useRemoveCodeFolder(projectId)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <>
      <tr className={cn('border-t border-line-soft', folder.missing && 'text-ink-faint')}>
        <td className="w-8 pl-2">
          <button
            className="rounded p-1 hover:bg-fog disabled:opacity-40"
            onClick={() => setOpen(!open)}
            disabled={folder.missing}
            aria-label={`Show what ${folder.label} excludes`}
            aria-expanded={open}
          >
            <Chevron size={15} />
          </button>
        </td>
        <td className="px-3 py-2.5 font-mono font-medium">{folder.label}</td>
        <td className="max-w-80 truncate px-3 py-2.5 font-mono text-[13px]" title={folder.path}>
          {folder.path}
        </td>
        <td className="px-3 py-2.5">
          <BranchCell folder={folder} />
        </td>
        <td className="px-3 py-2.5">
          <StateTags folder={folder} />
        </td>
        <td className="px-2 text-right whitespace-nowrap">
          <Button size="sm" variant="quiet" onClick={() => setEditing(!editing)} aria-label={`Edit ${folder.label}`}>
            <Pencil size={14} />
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate(folder.id)}
            aria-label={`Unlink ${folder.label}`}
            title="Later sessions stop reading it. The folder itself is not touched."
          >
            <Ban size={14} /> Unlink
          </Button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={COLUMNS} className="p-3">
            <EditCodeFolderForm projectId={projectId} folder={folder} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
      {open && (
        <tr>
          <td colSpan={COLUMNS}>
            <ExclusionPreview projectId={projectId} folderId={folder.id} label={folder.label} />
          </td>
        </tr>
      )}
    </>
  )
}

export function CodeFoldersPanel({ projectId }: Readonly<{ projectId: string }>) {
  const { data: folders, error } = useCodeFolderState(projectId)
  const [linking, setLinking] = useState(false)
  if (error) return <p className="text-sm text-redpencil">{error.message}</p>
  if (!folders) return <PageLoading />
  const linkButton = (
    <Button onClick={() => setLinking(true)}>
      <Plus size={15} /> Link a Code Folder
    </Button>
  )
  return (
    <section>
      <p className="max-w-2xl text-sm text-ink-soft">
        Folders of source code on this machine that Grilling Sessions may read, search and list — never change. Claude
        treats what it finds as how the app works today, never as what should happen. Secret files are always excluded.
      </p>
      {folders.length === 0 && !linking && (
        <div className="mt-5">
          <EmptyState title="No Code Folders yet" action={linkButton}>
            Link the code this Project’s work items change, and sessions can look before they ask.
          </EmptyState>
        </div>
      )}
      {folders.length > 0 && (
        <table className="mt-5 w-full overflow-hidden rounded-lg border border-line bg-sheet text-sm">
          <thead className="bg-fog text-left text-[12px] text-ink-faint uppercase">
            <tr>
              <th />
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 font-medium">Branch now</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <Fragment key={folder.id}>
                <FolderRow projectId={projectId} folder={folder} />
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4">
        {linking && <LinkCodeFolderForm projectId={projectId} onDone={() => setLinking(false)} />}
        {!linking && folders.length > 0 && linkButton}
      </div>
    </section>
  )
}
