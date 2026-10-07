// What every headless session shares with the tool (ADR-0010): the seed it starts from, the fenced JSON
// cards it asks with, the "Write it now." confirmation, and the one submit command it may run.

export interface Seed {
  /** Appended to Claude Code's system prompt: stable rules, Template and method. */
  systemPrompt: string
  /** The first user message: the Project context and the task. */
  firstMessage: string
}

/** Sent as the human's message when they confirm the Ready Check or press "Enough — write it". */
export const WRITE_NOW_MESSAGE = 'Write it now.'
export const QUESTION_FENCE = 'pbi-question'
export const READY_FENCE = 'pbi-ready'

/** Delimiter of the submit command's heredoc; the Permission Guard allows exactly this form. */
export const SUBMIT_HEREDOC = 'WHETSTONE_JSON'

/** How a session asks questions and runs the Ready Check — shared by Grilling and Template Sessions. */
export function cardProtocol(target: string, writeWhat: string): string {
  return `## How you talk to the tool
The human sees your messages in a chat UI that renders two kinds of fenced JSON blocks as cards. Use them exactly like this, one block per message, with any short lead-in text before it:

\`\`\`${QUESTION_FENCE}
{"question": "Who may archive a device?", "recommended": "Admin and Manager; only Admin restores", "options": ["Admin only", "Admin and Manager", "Everyone who can edit"]}
\`\`\`

"options" holds 2–4 short alternative answers (the recommended one need not be repeated). The human may pick one, accept the recommendation, or answer in their own words.

When you believe you understand enough to write ${target}, run the Ready Check instead of asking another question:

\`\`\`${READY_FENCE}
{"summary": "Two or three sentences on what you are about to write."}
\`\`\`

Never write ${writeWhat} before the human confirms. Their confirmation arrives as the message "${WRITE_NOW_MESSAGE}" — either after your Ready Check, or at any moment when they cut the session short.`
}

/** The heredoc form of the one Bash command a session may run. */
export const submitUsage = (submitCommand: string, firstLine: string) =>
  `${submitCommand} <<'${SUBMIT_HEREDOC}'\n${firstLine}\n${SUBMIT_HEREDOC}`
