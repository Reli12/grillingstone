// Legal page: where the human's data goes, and that what reaches the Assistant, and what is done with the result,
// is the human's responsibility, not the author's.
import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { ProseSection } from '@/components/composite/proseSection/proseSection'

/** The tool keeps data local; only the Assistant sends it on, to its maker, on the human's own account. */
export function YourDataNote() {
  return (
    <ProseSection id="your-data" title="Your data and your responsibility">
      <p>
        <strong>Grilling Stone itself sends nothing anywhere.</strong> It has no accounts, no telemetry and no server of
        its own: your Projects, Drafts, Glossaries, Transcripts, Templates and settings stay in its{' '}
        <InlineCode>data/</InlineCode> folder on your machine.
      </p>
      <p>
        <strong>Your Assistant sends your sessions to its maker:</strong> Claude Code sends them to Anthropic, and Codex
        to OpenAI. What you type, the Draft, Glossary and References a session starts from, and the files it reads in
        the Project folder go there on your own account, and the Assistant may search the web while it works. Each maker
        handles that data under its own terms and privacy policy, linked above.
      </p>
      <p>You decide what goes in, so:</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>You are responsible for what you share with your Assistant.</strong> Share only what you are allowed
          to: check your employer’s or client’s rules before entering confidential information, and don’t enter personal
          data, passwords, keys or other secrets unless your organization and your plan allow it.
        </li>
        <li>
          <strong>You are responsible for what you do with the result.</strong> The Assistant can be wrong; review every
          Draft before you copy it into Azure DevOps or rely on it.
        </li>
        <li>
          <strong>The author of Grilling Stone never receives, sees or stores your data</strong>, and isn’t responsible
          for what you share, for how Anthropic, OpenAI or any other service handles it, or for decisions based on the
          Assistant’s output. As the MIT License says, the tool comes as is, without warranty of any kind.
        </li>
      </ul>
    </ProseSection>
  )
}
