// Choosing the Assistant that runs every session, and how to set up each one.
import { Link } from 'react-router'

import { ASSISTANT_LABELS, ASSISTANT_NAMES, ASSISTANT_SETUP } from '#core/session/assistantName.ts'

import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { GuideStep } from '@/components/features/guide/guideStep/guideStep'
import { ASSISTANT_ACCOUNTS } from '@/constants/AssistantConstants'
import { routesPaths } from '@/routes/routes'

/** Choosing the Assistant that runs every session, and how to set up each one. */
export function StepAssistant() {
  return (
    <GuideStep id="assistant">
      <p>
        Grilling Stone doesn’t talk to an AI itself. It runs a coding agent you already have on your machine, the{' '}
        <strong>Assistant</strong>: <strong>Claude</strong> or <strong>Codex</strong>. Set up either one; you need only
        the one you will use.
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        {ASSISTANT_NAMES.map((name) => (
          <li key={name}>
            <strong>{ASSISTANT_LABELS[name]}</strong> runs as {ASSISTANT_ACCOUNTS[name]}. Install it with{' '}
            <InlineCode>{ASSISTANT_SETUP[name].install}</InlineCode> and sign in with{' '}
            <InlineCode>{ASSISTANT_SETUP[name].signIn}</InlineCode>.
          </li>
        ))}
      </ul>
      <p>
        Settings show whether each one is ready, or what is still missing. Every new session runs on the Assistant
        chosen there, and you can switch at any time. A session you want to <strong>Continue</strong> stays with the
        Assistant that held it, because only that one remembers the conversation; a new session on any Draft works with
        either.{' '}
        <Link to={routesPaths.settings} className="text-claude underline">
          Choose it in Settings
        </Link>
      </p>
    </GuideStep>
  )
}
