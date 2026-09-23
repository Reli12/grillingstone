import { useSettings } from '@/api/hooks/projects/projectHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { SettingsForm } from '@/components/features/settings/settingsForm/settingsForm'
import { ThemeChoice } from '@/components/features/settings/themeChoice/themeChoice'

export default function SettingsPage() {
  const { data } = useSettings()
  if (!data) return <PageLoading />
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="font-serif text-[30px] leading-tight font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-ink-soft">Sessions run as headless Claude Code on your own subscription, inside each Project’s folder.</p>
        <div className="mt-8 space-y-10">
          <ThemeChoice settings={data} />
          <SettingsForm settings={data} />
        </div>
      </div>
    </div>
  )
}
