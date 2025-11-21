import fs from 'node:fs'
import path from 'node:path'

type ModerationField = {
  label: string
  text: string
}

type ModerationRequest = {
  context: 'profile' | 'upload' | 'message' | 'comment'
  fields: ModerationField[]
}

type ModerationResponse = {
  approved: boolean
  issues: ModerationIssue[]
}

type ModerationIssue = {
  field: string
  snippet: string
  reason: string
}

type TermRule = {
  label: string
  reason: string
  terms: string[]
}

type ModerationConfig = {
  rules: TermRule[]
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

const TERM_RULES = loadTermRules()

function loadTermRules(): TermRule[] {
  const configPath = path.resolve(__dirname, '../../..', 'shared', 'moderationTerms.json')
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as ModerationConfig
    return parsed.rules || []
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to load moderation terms; moderation disabled until config is fixed.', error)
    return []
  }
}

type CompiledRule = {
  label: string
  reason: string
  pattern: RegExp
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

function scanField(field: ModerationField): ModerationIssue[] {
  const issues: ModerationIssue[] = []
  const normalizedText = normalize(field.text)

  for (const rule of COMPILED_RULES) {
    if (!normalizedText) {
      break
    }
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

export function enforceModeration(context: ModerationRequest['context'], fields: ModerationField[]): void {
  const sanitized = fields
    .map((field) => ({
      label: field.label,
      text: (field.text ?? '').trim(),
    }))
    .filter((field) => field.text.length > 0)

  if (!sanitized.length) {
    return
  }

  const outcome = review({ context, fields: sanitized })
  if (!outcome.approved) {
    const issue = outcome.issues[0]
    const message = issue ? `${issue.reason} (${issue.field}).` : 'Content needs another pass before sharing.'
    const error = new Error(message)
    ;(error as any).status = 400
    throw error
  }
}
