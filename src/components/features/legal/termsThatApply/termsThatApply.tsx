// Legal page: Anthropic's terms and policies that govern the human's use of Claude through the tool.
import { ExternalLink } from '@/components/atoms/externalLink/externalLink'
import { ProseSection } from '@/components/composite/proseSection/proseSection'
import { ANTHROPIC_PAGES } from '@/constants/LegalConstants'

/** Each session runs on the human's own Claude account, so Anthropic's terms are the ones that apply. */
export function TermsThatApply() {
  return (
    <ProseSection id="terms-that-apply" title="The rules that apply to you">
      <p>
        Every session runs on your own Claude account, so your use of Claude through Grilling Stone is governed by
        Anthropic’s terms, exactly as when you use Claude Code directly.
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <ExternalLink href={ANTHROPIC_PAGES.consumerTerms}>Consumer Terms of Service</ExternalLink>: when you sign in
          with a Claude Free, Pro or Max plan.
        </li>
        <li>
          <ExternalLink href={ANTHROPIC_PAGES.commercialTerms}>Commercial Terms of Service</ExternalLink>: when you use
          a Team or Enterprise plan or an Anthropic API key.
        </li>
        <li>
          <ExternalLink href={ANTHROPIC_PAGES.usagePolicy}>Usage Policy</ExternalLink>: what Claude may and may not be
          used for.
        </li>
        <li>
          <ExternalLink href={ANTHROPIC_PAGES.privacyPolicy}>Privacy Policy</ExternalLink>: how Anthropic handles what
          your sessions send to Claude.
        </li>
        <li>
          <ExternalLink href={ANTHROPIC_PAGES.claudeCodeLegal}>Claude Code legal and compliance</ExternalLink>:
          Anthropic’s rules for tools that run Claude Code, which the next section follows point by point.
        </li>
      </ul>
    </ProseSection>
  )
}
