// The outside pages the Legal page cites, and the day their content was last compared with the tool.

/** One published terms or policy page, and when it applies to the human. */
export interface TermsPage {
  label: string
  href: string
  appliesWhen: string
}

/** Anthropic's published terms and policies that govern a human's use of Claude and Claude Code. */
export const ANTHROPIC_TERMS: TermsPage[] = [
  {
    label: 'Consumer Terms of Service',
    href: 'https://www.anthropic.com/legal/consumer-terms',
    appliesWhen: 'when you sign in with a Claude Free, Pro or Max plan.',
  },
  {
    label: 'Commercial Terms of Service',
    href: 'https://www.anthropic.com/legal/commercial-terms',
    appliesWhen: 'when you use a Team or Enterprise plan or an Anthropic API key.',
  },
  {
    label: 'Usage Policy',
    href: 'https://www.anthropic.com/legal/aup',
    appliesWhen: 'what Claude may and may not be used for.',
  },
  {
    label: 'Privacy Policy',
    href: 'https://www.anthropic.com/legal/privacy',
    appliesWhen: 'how Anthropic handles what your sessions send to Claude.',
  },
  {
    label: 'Claude Code legal and compliance',
    href: 'https://code.claude.com/docs/en/legal-and-compliance',
    appliesWhen:
      'Anthropic’s rules for tools that run Claude Code, which the section on Claude Code below follows point by point.',
  },
]

/** OpenAI's published terms and policies that govern a human's use of Codex and ChatGPT. */
export const OPENAI_TERMS: TermsPage[] = [
  {
    label: 'Terms of Use',
    href: 'https://openai.com/policies/terms-of-use/',
    appliesWhen: 'when you sign in with a ChatGPT plan for individuals.',
  },
  {
    label: 'Services Agreement',
    href: 'https://openai.com/policies/services-agreement/',
    appliesWhen: 'when you use an OpenAI API key or a ChatGPT plan for businesses.',
  },
  {
    label: 'Usage Policies',
    href: 'https://openai.com/policies/usage-policies/',
    appliesWhen: 'what OpenAI’s models may and may not be used for.',
  },
  {
    label: 'OpenAI Privacy Policy',
    href: 'https://openai.com/policies/privacy-policy/',
    appliesWhen: 'how OpenAI handles what your sessions send to it.',
  },
  {
    label: 'Sign in with ChatGPT developer docs',
    href: 'https://developers.openai.com/siwc/token-sharing-open-source',
    appliesWhen: 'OpenAI’s rule for apps that use your ChatGPT plan, which the section on Codex below follows.',
  },
]

/** When the Legal page was last compared with each provider's pages above; they may have changed since. */
export const TERMS_CHECKED_ON = { anthropic: '15 October 2026', openai: '20 October 2026' } as const

/** The copyright line, as in the repository's LICENSE file. */
export const COPYRIGHT_NOTICE = '© 2026 Dorijan Polanc'
