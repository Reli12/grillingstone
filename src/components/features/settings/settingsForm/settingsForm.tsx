// The Settings form for the Iteration Log author and the Claude model.
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import type { Settings } from '#core/contract/apiTypes.ts'

import { useSaveSettings } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { type SettingsFormData, settingsSchema } from '@/lib/formSchemas/settingsSchema'

interface SettingsFormProps {
  settings: Settings
}

/** Author and model; saved together with the Save button. */
export function SettingsForm({ settings }: Readonly<SettingsFormProps>) {
  const save = useSaveSettings()
  const { register, handleSubmit, formState, reset } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })
  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { ...settings, ...values },
      {
        onSuccess: (saved) => {
          // The saved values become the new baseline, so Save disables again until the next edit.
          reset({ author: saved.author, model: saved.model })
          toast.success('Settings saved.')
        },
      },
    ),
  )
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div>
        <FieldLabel htmlFor="author" hint="Iteration Log lines read “22.09.2026 - @author v2”.">
          Your name in the Iteration Log
        </FieldLabel>
        <TextInput id="author" {...register('author')} />
        <FieldError message={formState.errors.author?.message} />
      </div>
      <div>
        <FieldLabel htmlFor="model" hint="Leave empty for Claude Code’s default. Aliases like opus or sonnet work.">
          Model for Grilling Sessions
        </FieldLabel>
        <TextInput id="model" placeholder="Claude Code default" {...register('model')} />
      </div>
      <Button type="submit" variant="ink" disabled={!formState.isDirty || save.isPending}>
        Save settings
      </Button>
    </form>
  )
}
