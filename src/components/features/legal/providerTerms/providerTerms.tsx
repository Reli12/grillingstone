// Legal page: one provider's published terms and policies, each linked with when it applies.
import { ExternalLink } from '@/components/atoms/externalLink/externalLink'
import type { TermsPage } from '@/constants/LegalConstants'

/** A provider's terms pages as a list: the link, then when that page applies. */
export function ProviderTerms({ pages }: Readonly<{ pages: TermsPage[] }>) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {pages.map((page) => (
        <li key={page.href}>
          <ExternalLink href={page.href}>{page.label}</ExternalLink>: {page.appliesWhen}
        </li>
      ))}
    </ul>
  )
}
