// Legal page: the provider terms and policies that govern the human's use of their Assistant through the tool.
import { ProseSection } from '@/components/composite/proseSection/proseSection'
import { ProviderTerms } from '@/components/features/legal/providerTerms/providerTerms'
import { ANTHROPIC_TERMS, OPENAI_TERMS } from '@/constants/LegalConstants'

/** Each session runs on the human's own account with their Assistant's maker, so that maker's terms apply. */
export function TermsThatApply() {
  return (
    <ProseSection id="terms-that-apply" title="The rules that apply to you">
      <p>
        Every session runs on your own account with the Assistant you chose, so your use of it through Grilling Stone is
        governed by its maker’s terms, exactly as when you use it directly. With <strong>Claude</strong>, Anthropic’s:
      </p>
      <ProviderTerms pages={ANTHROPIC_TERMS} />
      <p>
        With <strong>Codex</strong>, OpenAI’s:
      </p>
      <ProviderTerms pages={OPENAI_TERMS} />
    </ProseSection>
  )
}
