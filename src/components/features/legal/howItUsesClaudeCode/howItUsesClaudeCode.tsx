// Legal page: how the tool runs Claude Code, set against Anthropic's conditions for tools that run it.
import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { ProseSection } from '@/components/composite/proseSection/proseSection'

/** The facts behind each of Anthropic's conditions for tools that run Claude Code, one bullet per condition. */
export function HowItUsesClaudeCode() {
  return (
    <ProseSection id="how-it-uses-claude-code" title="How Grilling Stone uses Claude Code">
      <p>
        Grilling Stone doesn’t call Claude itself. It starts your own installed, unmodified Claude Code on your machine
        (<InlineCode>claude -p</InlineCode>), one process per session, the way any script can. Against Anthropic’s rules
        for tools that run Claude Code:
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Unmodified.</strong> It runs Claude Code as Anthropic publishes it, with its ordinary options, and
          removes none of its sign-in methods.
        </li>
        <li>
          <strong>Your own sign-in.</strong> You sign in to Claude Code through Anthropic’s own flow (
          <InlineCode>claude auth login</InlineCode>), with a Claude subscription or an Anthropic API key. Grilling
          Stone never sees, stores or passes on your credentials.
        </li>
        <li>
          <strong>Your own account.</strong> Every session is billed to your account under your own agreement with
          Anthropic. Grilling Stone doesn’t pay for, resell or route Claude usage on anyone’s behalf.
        </li>
        <li>
          <strong>You at the wheel.</strong> Every session starts because you started it, and Claude waits for your
          answer between questions. Nothing runs on a schedule or without you.
        </li>
        <li>
          <strong>Not bundled.</strong> Claude Code isn’t part of this repository or its license. You install it
          yourself; the Docker setup installs Anthropic’s published package while you build the image on your own
          machine.
        </li>
      </ul>
    </ProseSection>
  )
}
