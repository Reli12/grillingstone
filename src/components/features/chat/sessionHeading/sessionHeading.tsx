// A session's heading in the chat thread: its kind, when it started and its status.
import type { SessionBase } from '#core/session/sessionTypes.ts'

import { SESSION_TITLES } from '@/constants/SessionConstants'
import type { AnyTranscript } from '@/types/chat'

const STATUS_TEXT: Record<SessionBase['status'], string> = {
  starting: 'starting',
  thinking: 'running',
  waiting: 'running',
  writing: 'writing',
  finished: 'finished',
  stopped: 'stopped',
  failed: 'failed',
  interrupted: 'interrupted',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface SessionHeadingProps {
  transcript: AnyTranscript
}

export function SessionHeading({ transcript }: Readonly<SessionHeadingProps>) {
  return (
    <>
      <span className="font-semibold text-ink">{SESSION_TITLES[transcript.kind]}</span>
      {transcript.focus && <span className="text-ink-soft"> on {transcript.focus.heading}</span>}
      <span className="text-ink-faint">
        , {time(transcript.startedAt)}, {STATUS_TEXT[transcript.status]}
      </span>
    </>
  )
}
