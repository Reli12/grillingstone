// What a Code Folder keeps from sessions: each exclusion rule with its count and a few examples, how many files
// stay readable, and the committed examples that stay readable on purpose (ADR-0017).
import { useCodeFolderExclusions } from '@/api/hooks/codeFolders/codeFolderHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'

export function ExclusionPreview({
  projectId,
  folderId,
  label,
}: Readonly<{ projectId: string; folderId: string; label: string }>) {
  const { data: preview, error } = useCodeFolderExclusions(projectId, folderId)
  return (
    <section aria-label={`What ${label} excludes`} className="bg-fog px-4 py-3 text-[13px]">
      {error && <p className="text-redpencil">{error.message}</p>}
      {!preview && !error && <PageLoading />}
      {preview && (
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <table className="w-full">
            <tbody>
              {preview.groups.map((group) => (
                <tr key={group.rule} className="border-b border-line-soft last:border-0">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {group.label}
                    {group.fixed && <span className="ml-1.5 text-[11px] font-normal text-ink-faint">always</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{group.count.toLocaleString('en')}</td>
                  <td className="py-1.5 font-mono text-[12px] text-ink-soft">{group.examples.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <p className="font-medium">{preview.readable.toLocaleString('en')} files readable</p>
            {preview.stillReadable.length > 0 && (
              <>
                <p className="mt-1 text-ink-faint">Readable on purpose:</p>
                <ul className="font-mono text-[12px] text-ink-soft">
                  {preview.stillReadable.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
