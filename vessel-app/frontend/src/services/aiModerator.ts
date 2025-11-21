import moderationConfig from '../../../shared/moderationTerms.json'

type ModerationField = {
  label: string
  text: string
}

type ModerationIssue = {
  field: string
  snippet: string
  reason: string
}

type ModerationRequest = {
  context: 'profile' | 'upload' | 'message' | 'comment'
  fields: ModerationField[]
}

type ModerationResponse = {
  approved: boolean
  issues: ModerationIssue[]
}

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  '$': 's',
  '!': 'i',
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split('')
    .map((char) => {
      if (/[a-z]/.test(char)) return char
      if (LEET_MAP[char]) return LEET_MAP[char]
      if (/\s/.test(char)) return ' '
      return ' '
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

type TermRule = {
  label: string
  reason: string
  terms: string[]
}

type ModerationConfig = {
  rules: TermRule[]
}

const TERM_RULES: TermRule[] = (moderationConfig as ModerationConfig).rules

type CompiledRule = {
  label: string
  reason: string
  pattern: RegExp
}

function termToPattern(term: string): RegExp | null {
  const normalized = normalize(term)
  if (!normalized) {
    return null
  }
  const wordPatterns = normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.split('').map((char) => `${char}+`).join('[\\s]*'))
  const body = wordPatterns.join('\\s+')
  return new RegExp(`(^|\\s)${body}(?=\\s|$)`, 'i')
}

const COMPILED_RULES: CompiledRule[] = TERM_RULES.flatMap((rule) =>
  rule.terms
    .map((term) => {
      const pattern = termToPattern(term)
      if (!pattern) return null
      return {
        label: rule.label,
        reason: rule.reason,
        pattern,
      }
    })
    .filter((entry): entry is CompiledRule => Boolean(entry))
)

function scanField(field: ModerationField): ModerationIssue[] {
  const issues: ModerationIssue[] = []
  const normalizedText = normalize(field.text)

  for (const rule of COMPILED_RULES) {
    if (!normalizedText) break
    if (rule.pattern.test(normalizedText)) {
      issues.push({
        field: field.label,
        snippet: field.text,
        reason: rule.reason,
      })
    }
    rule.pattern.lastIndex = 0
  }

  return issues
}

function review(request: ModerationRequest): ModerationResponse {
  const issues = request.fields.flatMap(scanField)
  return {
    approved: issues.length === 0,
    issues,
  }
}

export const aiModerator = {
  review,
}

export type { ModerationRequest, ModerationResponse, ModerationIssue, ModerationField }
