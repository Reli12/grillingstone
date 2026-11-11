// The Settings page's Azure DevOps Connection: organization URL and Personal Access Token, tested before anything is
// saved. The token field is write-only once saved; a token from the environment makes the card read-only.
import { useState } from 'react'

import { AlertTriangle, Check, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import type { ConnectionStatus } from '#core/ado/adoTypes.ts'

import { useConnection, useDisconnect, useSaveConnection } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'

function StatusLine({ status }: Readonly<{ status: ConnectionStatus }>) {
  if (status.state === 'connected')
    return (
      <p className="flex items-center gap-2 text-sm text-proof">
        <Check size={15} /> Connected as {status.user ?? 'unknown user'} to {status.organization ?? status.orgUrl}
      </p>
    )
  if (status.state === 'rejected')
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-redpencil">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        Token rejected — it may have expired or been revoked. Paste a new one.
      </p>
    )
  return <p className="text-sm text-ink-faint">Not connected. Azure DevOps Projects work by copy and paste.</p>
}

function ConnectionForm({ status }: Readonly<{ status: ConnectionStatus }>) {
  const save = useSaveConnection()
  const disconnect = useDisconnect()
  const [orgUrl, setOrgUrl] = useState(status.orgUrl ?? '')
  const [token, setToken] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = status.state !== 'none'
  const readOnly = status.fromEnvironment
  const showSavedToken = saved && !replacing && !readOnly

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setError(null)
    save.mutate(
      { orgUrl, token },
      {
        onSuccess: () => {
          setToken('')
          setReplacing(false)
          toast.success('Connected to Azure DevOps.')
        },
        onError: (failure) => setError(failure.message),
      },
    )
  }

  const tokenHint = readOnly
    ? status.storage
    : `Needs the “Work Items: Read & write” scope. ${status.storage} Claude never sees it.`

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <FieldLabel htmlFor="ado-org">Organization URL</FieldLabel>
        <TextInput
          id="ado-org"
          placeholder="https://dev.azure.com/your-org"
          value={orgUrl}
          disabled={readOnly}
          onChange={(event) => setOrgUrl(event.target.value)}
        />
      </div>
      <div>
        <FieldLabel htmlFor="ado-pat" hint={tokenHint}>
          Personal Access Token
        </FieldLabel>
        {showSavedToken ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-fog px-3 text-sm text-ink-soft">
            <KeyRound size={14} /> A token is saved
            <button
              type="button"
              className="ml-auto text-[13px] underline hover:text-ink"
              onClick={() => setReplacing(true)}
            >
              Replace
            </button>
          </div>
        ) : (
          <TextInput
            id="ado-pat"
            type="password"
            autoComplete="off"
            disabled={readOnly}
            placeholder={readOnly ? '•••••••• (environment)' : 'Paste a token'}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        )}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            variant="ink"
            disabled={save.isPending || !orgUrl.trim() || !token.trim() || showSavedToken}
          >
            {save.isPending && <Loader2 size={15} className="animate-spin" />} Test & save
          </Button>
          {saved && (
            <Button variant="danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-redpencil">
          {error}
        </p>
      )}
      <StatusLine status={status} />
    </form>
  )
}

export function ConnectionCard() {
  const { data: status } = useConnection()
  return (
    <fieldset className="rounded-lg border border-line bg-sheet p-5">
      <legend className="px-1 text-sm font-semibold">Azure DevOps</legend>
      <p className="-mt-1 mb-4 text-[13px] text-ink-faint">
        Optional. Lets the tool Publish, Import, Refresh and check for Drift as you, in one organization.
      </p>
      {/* key: a new status (saved, disconnected) starts the form afresh. */}
      {status && <ConnectionForm key={`${status.state}-${status.orgUrl ?? ''}`} status={status} />}
    </fieldset>
  )
}
