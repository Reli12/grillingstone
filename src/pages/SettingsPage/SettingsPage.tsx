// The Settings page: the theme, the Default Tracker, the Iteration Log author and the Claude model.
import { useSettings } from '@/api/hooks/projects/projectHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { DefaultTrackerChoice } from '@/components/features/settings/defaultTrackerChoice/defaultTrackerChoice'
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
          Sessions run as headless Claude Code on your own Claude account, inside each Project’s folder.
        </p>
        <div className="mt-8 space-y-10">
          <ThemeChoice settings={settings} />
          <DefaultTrackerChoice settings={settings} />
          <SettingsForm settings={settings} />
        </div>
      </div>
    </div>
  )
}
