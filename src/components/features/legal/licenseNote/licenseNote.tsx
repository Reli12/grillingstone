// Legal page: the tool's own license, which covers this repository's code and nothing it runs.
import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { ProseSection } from '@/components/composite/proseSection/proseSection'

/** MIT for the tool's code; each Assistant stays under its maker's terms. */
export function LicenseNote() {
  return (
    <ProseSection id="license" title="License">
      <p>
        Grilling Stone is free to use, copy, change and share under the MIT License; the full text is in the{' '}
        <InlineCode>LICENSE</InlineCode> file in the repository. It comes as is, without warranty of any kind. The
        license covers this tool’s own code only, not Claude Code, Codex or the models they use.
      </p>
    </ProseSection>
  )
}
