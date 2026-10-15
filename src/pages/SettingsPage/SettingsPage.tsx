// The Settings page: the theme, the Assistant, the Iteration Log author and the Assistant's model.
import { useSettings } from '@/api/hooks/projects/projectHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { AssistantChoice } from '@/components/features/settings/assistantChoice/assistantChoice'
import { SettingsForm } from '@/components/features/settings/settingsForm/settingsForm'
import { ThemeChoice } from '@/components/features/settings/themeChoice/themeChoice'

export default function SettingsPage() {
  const { data: settings } = useSettings()
  if (!settings) return <PageLoading />
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="font-serif text-[30px] leading-tight font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-ink-soft">
          Sessions run on the Assistant you choose, with your own account, inside each Project’s folder.
        </p>
        <div className="mt-8 space-y-10">
          <ThemeChoice settings={settings} />
          <AssistantChoice settings={settings} />
          {/* Remounted per Assistant, so the model field starts from that Assistant's saved model. */}
          <SettingsForm key={settings.assistant} settings={settings} />
        </div>
      </div>
    </div>
  )
}
