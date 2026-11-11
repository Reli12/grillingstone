// Import: a new Draft from an existing work item in the Project's Backlog, named by its ID or link (or started from a
// Backlog Copy, which still reads the live item). The human confirms the item, then picks only a Template: the type
// is the item's. The Import Session then writes v1 from the item's own words.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { ExternalLink } from 'lucide-react'

import { templateTracker } from '#core/template/templateTypes.ts'

import type { WorkItemPreview } from '@/api/adoApi'
import { useImportCopy, useImportDraft, useLookupWorkItem } from '@/api/hooks/ado/adoHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { TemplatePicker } from '@/components/features/drafts/templatePicker/templatePicker'
import { routesPaths } from '@/routes/routes'

interface ImportDraftDialogProps {
  projectId: string
  open: boolean
  onClose: () => void
  /** Started from a Backlog Copy: its work item, read live. */
  fromCopy?: { copyId: string; workItemId: number }
}

function Preview({ projectId, preview }: Readonly<{ projectId: string; preview: WorkItemPreview }>) {
  return (
    <div className="rounded-md border border-line-soft bg-fog px-3 py-2.5 text-sm">
      <p className="flex items-center gap-2">
        <span className="text-ink-faint">{preview.adoType}</span>
        <span className="font-medium">
          #{preview.id} {preview.title}
        </span>
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in Azure DevOps"
          className="text-claude"
        >
          <ExternalLink size={13} />
        </a>
      </p>
      <p className="text-[13px] text-ink-faint">{preview.parentId ? `Parent #${preview.parentId}` : 'No parent'}</p>
      {preview.refusal && (
        <p role="alert" className="mt-1.5 text-[13px] text-redpencil">
          {preview.refusal}{' '}
          {preview.linkedDraftId && (
            <Link to={routesPaths.draft(projectId, preview.linkedDraftId)} className="underline">
              Open that Draft
            </Link>
          )}
        </p>
      )}
    </div>
  )
}

export function ImportDraftDialog({ projectId, open, onClose, fromCopy }: Readonly<ImportDraftDialogProps>) {
  const navigate = useNavigate()
  const lookup = useLookupWorkItem(projectId)
  const importDraft = useImportDraft(projectId)
  const importCopy = useImportCopy(projectId)
  const { data: templates } = useTemplates()
  const [workItem, setWorkItem] = useState(fromCopy ? String(fromCopy.workItemId) : '')
  const [templateId, setTemplateId] = useState<string>()
  const preview = lookup.data
  const forType =
    templates?.filter(
      (template) => templateTracker(template) === 'azure-devops' && template.workItemType === preview?.workItemType,
    ) ?? []
  const chosen = templateId ?? forType.find((template) => template.isDefault)?.id ?? forType[0]?.id
  const pending = importDraft.isPending || importCopy.isPending
  const error = lookup.error ?? importDraft.error ?? importCopy.error

  const find = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setTemplateId(undefined)
    lookup.mutate(workItem)
  }
  const start = () => {
    if (!chosen || !preview) return
    const onSuccess = ({ draft }: { draft: { id: string } }) => void navigate(routesPaths.draft(projectId, draft.id))
    if (fromCopy) importCopy.mutate({ copyId: fromCopy.copyId, templateId: chosen }, { onSuccess })
    else importDraft.mutate({ workItem: String(preview.id), templateId: chosen }, { onSuccess })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Import from Azure DevOps">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          The new Draft takes the item’s type and starts linked to it. An Import Session moves the item’s content into
          the Template’s Sections word for word — nothing is reworded or added; Sections it lacks stay empty.
        </p>
        <form onSubmit={find}>
          <FieldLabel htmlFor="import-work-item" hint="Its ID (1234 or #1234) or its Azure DevOps link.">
            Work item
          </FieldLabel>
          <div className="flex gap-2">
            <TextInput id="import-work-item" value={workItem} onChange={(event) => setWorkItem(event.target.value)} />
            <Button type="submit" disabled={!workItem.trim() || lookup.isPending}>
              {lookup.isPending ? 'Looking…' : 'Look up'}
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="text-sm text-redpencil">
            {error.message}
          </p>
        )}
        {preview && <Preview projectId={projectId} preview={preview} />}
        {preview && !preview.refusal && (
          <>
            {forType.length ? (
              <TemplatePicker templates={forType} chosenId={chosen} onChoose={setTemplateId} />
            ) : (
              <p className="text-sm text-ink-faint">No Azure DevOps {preview.workItemType} Template.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="quiet" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="ink" disabled={!chosen || pending} onClick={start}>
                Import #{preview.id}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
