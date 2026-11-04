// Linking a Code Folder (paste a path, Check it, see refusals or warnings, then label, default branch and extra
// exclusions) and editing one (the same fields; the path is fixed). Rendered inline in the Code Folders tab.
import { useId, useState } from 'react'

import { TriangleAlert } from 'lucide-react'

import type { CodeFolderCheck, CodeFolderState } from '#core/codeFolder/codeFolderTypes.ts'
import type { Reason } from '#core/shared/validation.ts'

import { ApiError } from '@/api/apiError'
import { useAddCodeFolder, useCheckCodeFolder, useUpdateCodeFolder } from '@/api/hooks/codeFolders/codeFolderHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { TextInput } from '@/components/atoms/textInput/textInput'

const patternsOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** A failed save's reasons, or its message when it has none. */
const reasonsOf = (error: unknown): string[] => {
  if (!error) return []
  if (error instanceof ApiError && error.reasons?.length) return error.reasons.map((reason) => reason.message)
  return [error instanceof Error ? error.message : 'Something went wrong.']
}

function ReasonList({
  tone,
  title,
  reasons,
}: Readonly<{ tone: 'refused' | 'warned'; title: string; reasons: Reason[] }>) {
  const refused = tone === 'refused'
  return (
    <div
      role={refused ? 'alert' : 'status'}
      className={
        refused
          ? 'mt-3 rounded-md bg-redpencil-wash px-3 py-2 text-sm text-redpencil'
          : 'mt-3 rounded-md bg-mark-wash px-3 py-2 text-sm text-mark-ink'
      }
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {reasons.map((reason) => (
          <li key={reason.code} className="flex gap-1.5">
            {!refused && <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />}
            {reason.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface FieldsProps {
  label: string
  setLabel: (value: string) => void
  branch: string
  setBranch: (value: string) => void
  extra: string
  setExtra: (value: string) => void
  inGit: boolean
}

function Fields({ label, setLabel, branch, setBranch, extra, setExtra, inGit }: Readonly<FieldsProps>) {
  const id = useId()
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[200px_200px_1fr]">
      <div>
        <FieldLabel htmlFor={`${id}-label`}>Label</FieldLabel>
        <TextInput
          id={`${id}-label`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="font-mono"
        />
        <p className="mt-1 text-[12px] text-ink-faint">Claude cites code as “{label || 'label'}: src/…”</p>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-branch`}>Default branch</FieldLabel>
        <TextInput
          id={`${id}-branch`}
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
          placeholder={inGit ? 'main' : 'not in git'}
          className="font-mono"
        />
      </div>
      <div>
        <FieldLabel
          htmlFor={`${id}-extra`}
          hint="One pattern per line, e.g. exports/** — added to the fixed exclusions, never lifting them."
        >
          Extra exclusions
        </FieldLabel>
        <TextArea
          id={`${id}-extra`}
          minRows={2}
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
          className="font-mono text-[13px]"
        />
      </div>
    </div>
  )
}

/** Paste a path, Check it, then fill in the rest; a refused folder can't go further, a warned one only on purpose. */
export function LinkCodeFolderForm({ projectId, onDone }: Readonly<{ projectId: string; onDone: () => void }>) {
  const id = useId()
  const check = useCheckCodeFolder(projectId)
  const add = useAddCodeFolder(projectId)
  const [path, setPath] = useState('')
  const [checked, setChecked] = useState<CodeFolderCheck | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [label, setLabel] = useState('')
  const [branch, setBranch] = useState('')
  const [extra, setExtra] = useState('')

  const runCheck = () =>
    check.mutate(path.trim(), {
      onSuccess: (result) => {
        setChecked(result)
        setAccepted(false)
        setLabel(result.suggestedLabel)
        setBranch(result.suggestedDefaultBranch)
      },
    })
  const status = checked?.check.status
  const ready = status === 'ok' || (status === 'ok-with-warnings' && accepted)
  const link = () =>
    add.mutate(
      { path: path.trim(), label: label.trim(), defaultBranch: branch.trim(), extraExclusions: patternsOf(extra) },
      { onSuccess: onDone },
    )

  return (
    <section aria-label="Link a Code Folder" className="rounded-lg border border-claude/40 bg-sheet p-4">
      <FieldLabel htmlFor={`${id}-path`}>Folder path</FieldLabel>
      <div className="flex gap-2">
        <TextInput
          id={`${id}-path`}
          autoFocus
          value={path}
          onChange={(event) => {
            setPath(event.target.value)
            setChecked(null)
          }}
          onKeyDown={(event) => event.key === 'Enter' && path.trim() && runCheck()}
          placeholder="Paste a path, e.g. C:\work\client\app"
          className="font-mono"
        />
        <Button variant="ink" disabled={!path.trim() || check.isPending} onClick={runCheck}>
          Check
        </Button>
      </div>
      <FieldError message={check.error?.message} />
      {checked?.check.status === 'rejected' && (
        <ReasonList tone="refused" title="This folder can’t be linked" reasons={checked.check.reasons} />
      )}
      {checked?.check.status === 'ok-with-warnings' && (
        <>
          <ReasonList tone="warned" title="Before you link it" reasons={checked.check.warnings} />
          {!accepted && (
            <Button size="sm" className="mt-2" onClick={() => setAccepted(true)}>
              Link anyway
            </Button>
          )}
        </>
      )}
      {ready && checked && (
        <Fields
          label={label}
          setLabel={setLabel}
          branch={branch}
          setBranch={setBranch}
          extra={extra}
          setExtra={setExtra}
          inGit={checked.inGit}
        />
      )}
      {reasonsOf(add.error).map((message) => (
        <FieldError key={message} message={message} />
      ))}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
        {ready && (
          <Button variant="ink" disabled={!label.trim() || add.isPending} onClick={link}>
            Link Code Folder
          </Button>
        )}
      </div>
    </section>
  )
}

/** Edit a linked folder's label, default branch and extra exclusions. */
export function EditCodeFolderForm({
  projectId,
  folder,
  onDone,
}: Readonly<{ projectId: string; folder: CodeFolderState; onDone: () => void }>) {
  const update = useUpdateCodeFolder(projectId)
  const [label, setLabel] = useState(folder.label)
  const [branch, setBranch] = useState(folder.defaultBranch)
  const [extra, setExtra] = useState(folder.extraExclusions.join('\n'))
  const save = () =>
    update.mutate(
      {
        folderId: folder.id,
        change: { label: label.trim(), defaultBranch: branch.trim(), extraExclusions: patternsOf(extra) },
      },
      { onSuccess: onDone },
    )
  return (
    <section aria-label={`Edit ${folder.label}`} className="rounded-lg border border-claude/40 bg-sheet p-4">
      <p className="font-mono text-[13px] text-ink-faint">{folder.path}</p>
      <Fields
        label={label}
        setLabel={setLabel}
        branch={branch}
        setBranch={setBranch}
        extra={extra}
        setExtra={setExtra}
        inGit={folder.inGit}
      />
      {reasonsOf(update.error).map((message) => (
        <FieldError key={message} message={message} />
      ))}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="ink" disabled={!label.trim() || update.isPending} onClick={save}>
          Save
        </Button>
      </div>
    </section>
  )
}
