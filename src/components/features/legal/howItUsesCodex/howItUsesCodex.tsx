// Legal page: how the tool runs Codex, set against OpenAI's rule for apps that use the human's ChatGPT plan.
import { ASSISTANT_SETUP } from '#core/session/assistantName.ts'

import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { ProseSection } from '@/components/composite/proseSection/proseSection'

/** The facts behind OpenAI's rule for apps that use a ChatGPT plan, one bullet per point. */
export function HowItUsesCodex() {
  return (
    <ProseSection id="how-it-uses-codex" title="How Grilling Stone uses Codex">
      <p>
        Grilling Stone doesn’t call OpenAI itself. It starts your own installed, unmodified Codex on your machine (
        <InlineCode>codex app-server</InlineCode>), one process per session. OpenAI documents using a ChatGPT plan from
        other apps for open-source and locally hosted apps; Grilling Stone is both:
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Open source and local.</strong> Grilling Stone is free and MIT-licensed, and runs only on your own
          machine. It isn’t sold or hosted for anyone; a paid or remotely hosted service needs OpenAI’s permission, so
          whoever runs it that way must ask OpenAI first.
        </li>
        <li>
          <strong>Your own sign-in.</strong> You sign in to Codex through OpenAI’s own flow (
          <InlineCode>{ASSISTANT_SETUP.codex.signIn}</InlineCode>), with a ChatGPT plan or an OpenAI API key. Codex
          keeps that sign-in itself; Grilling Stone never sees, stores or passes on your credentials.
        </li>
        <li>
          <strong>Your own account.</strong> Every session is billed to your plan or API account under your own
          agreement with OpenAI. Grilling Stone doesn’t pay for, resell or route Codex usage on anyone’s behalf.
        </li>
        <li>
          <strong>You at the wheel.</strong> Every session starts because you started it, and Codex waits for your
          answer between questions. Nothing runs on a schedule or without you.
        </li>
        <li>
          <strong>Not bundled.</strong> Codex isn’t part of this repository or its license; you install OpenAI’s
          published package yourself.
        </li>
      </ul>
    </ProseSection>
  )
}
