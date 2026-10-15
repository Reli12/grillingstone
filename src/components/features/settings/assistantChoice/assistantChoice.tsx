// The Assistant setting (ADR-0020): Claude or Codex, each with whether it can run a session now.
import type { SettingsView } from '#core/contract/apiTypes.ts'
import { ASSISTANT_LABELS, ASSISTANT_NAMES, type AssistantName } from '#core/session/assistantName.ts'

import { useSaveSettings } from '@/api/hooks/projects/projectHooks'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { AvailabilityNote } from '@/components/features/settings/availabilityNote/availabilityNote'
import { ASSISTANT_ACCOUNTS } from '@/constants/AssistantConstants'
import { cn } from '@/lib/cn'

interface AssistantChoiceProps {
  settings: SettingsView
}

/** Saves on click, like the theme: every new session uses the chosen Assistant from then on. */
export function AssistantChoice({ settings }: Readonly<AssistantChoiceProps>) {
  const save = useSaveSettings()
  const choose = (assistant: AssistantName) => save.mutate({ ...settings, assistant })
  return (
    <fieldset>
      <FieldLabel hint="Every new session runs on it. A session you continue stays with the Assistant that held it.">
        Assistant
      </FieldLabel>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Assistant">
        {ASSISTANT_NAMES.map((name) => {
          const on = settings.assistant === name
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(name)}
              className={cn(
                'rounded-lg border p-3 text-left',
                on ? 'border-claude bg-sheet shadow-sm' : 'border-line hover:border-ink-faint',
              )}
            >
              <span className="block font-semibold text-ink">{ASSISTANT_LABELS[name]}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{ASSISTANT_ACCOUNTS[name]}</span>
              <span className="mt-1.5 block">
                <AvailabilityNote availability={settings.availability[name]} />
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
