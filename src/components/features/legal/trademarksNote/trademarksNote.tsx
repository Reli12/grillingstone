// Legal page: whose names the tool mentions, and that it is independent of their owners.
import { ProseSection } from '@/components/composite/proseSection/proseSection'

/** Claude, Azure DevOps and Jira are named only to say what the tool works with, never to suggest endorsement. */
export function TrademarksNote() {
  return (
    <ProseSection id="trademarks" title="Trademarks">
      <p>
        Anthropic, Claude and Claude Code are trademarks of Anthropic, PBC. Microsoft and Azure DevOps are trademarks of
        Microsoft Corporation. Atlassian and Jira are trademarks of Atlassian. Grilling Stone names them only to say
        what it works with. It is an independent project, not affiliated with, endorsed by or sponsored by Anthropic,
        Microsoft or Atlassian.
      </p>
    </ProseSection>
  )
}
