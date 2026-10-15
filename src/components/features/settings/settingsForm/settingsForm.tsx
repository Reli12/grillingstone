// The Settings form for the Iteration Log author and the chosen Assistant's model.
import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import type { Settings } from '#core/contract/apiTypes.ts'
import { ASSISTANT_LABELS } from '#core/session/assistantName.ts'

import { useSaveSettings } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { MODEL_HINTS, MODEL_PLACEHOLDERS } from '@/constants/AssistantConstants'
import { type SettingsFormData, settingsSchema } from '@/lib/formSchemas/settingsSchema'

interface SettingsFormProps {
  settings: Settings
}

/** Author and the chosen Assistant's model, saved together with the Save button; the other model is kept. */
export function SettingsForm({ settings }: Readonly<SettingsFormProps>) {
  const save = useSaveSettings()
  const { register, handleSubmit, formState, reset } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })
  const { assistant } = settings
  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { ...settings, ...values },
      {
        onSuccess: (saved) => {
          // The saved values become the new baseline, so Save disables again until the next edit.
          reset({ author: saved.author, models: saved.models })
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
        <FieldLabel htmlFor="model" hint={MODEL_HINTS[assistant]}>
          Model for {ASSISTANT_LABELS[assistant]}
        </FieldLabel>
        <TextInput id="model" placeholder={MODEL_PLACEHOLDERS[assistant]} {...register(`models.${assistant}`)} />
      </div>
      <Button type="submit" variant="ink" disabled={!formState.isDirty || save.isPending}>
        Save settings
      </Button>
    </form>
  )
}
