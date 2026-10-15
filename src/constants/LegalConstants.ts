// The outside pages the Legal page cites, and the day their content was last compared with the tool.

/** Anthropic's published terms and policies that govern a human's use of Claude and Claude Code. */
export const ANTHROPIC_PAGES = {
  consumerTerms: 'https://www.anthropic.com/legal/consumer-terms',
  commercialTerms: 'https://www.anthropic.com/legal/commercial-terms',
  usagePolicy: 'https://www.anthropic.com/legal/aup',
  privacyPolicy: 'https://www.anthropic.com/legal/privacy',
  claudeCodeLegal: 'https://code.claude.com/docs/en/legal-and-compliance',
} as const

/** When the Legal page was last compared with the pages above; they may have changed since. */
export const TERMS_CHECKED_ON = '15 October 2026'

/** The copyright line, as in the repository's LICENSE file. */
export const COPYRIGHT_NOTICE = '© 2026 Dorijan Polanc'
