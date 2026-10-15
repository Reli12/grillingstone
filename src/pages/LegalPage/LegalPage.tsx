// The Legal page: the tool's license, the terms that govern the Claude account it runs on, responsibility for
// the data shared with Claude, and trademarks.
import { HowItUsesClaudeCode } from '@/components/features/legal/howItUsesClaudeCode/howItUsesClaudeCode'
import { LicenseNote } from '@/components/features/legal/licenseNote/licenseNote'
import { TermsThatApply } from '@/components/features/legal/termsThatApply/termsThatApply'
import { TrademarksNote } from '@/components/features/legal/trademarksNote/trademarksNote'
import { YourDataNote } from '@/components/features/legal/yourDataNote/yourDataNote'
import { TERMS_CHECKED_ON } from '@/constants/LegalConstants'

export default function LegalPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-[680px] px-4 py-12 text-[15px] leading-relaxed text-ink-soft">
        <h1 className="font-serif text-[36px] leading-tight font-semibold tracking-tight text-ink">Legal</h1>
        <p className="mt-3">
          What Grilling Stone is licensed under, how it uses Claude Code, whose terms apply when you use it, and who is
          responsible for your data. Last compared with Anthropic’s published terms on {TERMS_CHECKED_ON}; if they
          differ, the linked pages are what counts. This page explains, it isn’t legal advice.
        </p>
        <div className="mt-10 space-y-10">
          <LicenseNote />
          <TermsThatApply />
          <HowItUsesClaudeCode />
          <YourDataNote />
          <TrademarksNote />
        </div>
      </article>
    </div>
  )
}
