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

type BlockRule = {
  label: string
  pattern: RegExp
  reason: string
}

const BLOCK_RULES: BlockRule[] = [
  { label: 'profanity', pattern: /\b(damn|hell|shit|bullshit|asshole|bastard)\b/gi, reason: 'Contains profanity.' },
  { label: 'explicit', pattern: /\b(fuck|fucking|motherfucker|dick|pussy|bitch)\b/gi, reason: 'Contains explicit language.' },
  {
   label: 'disrespect',
    pattern: /\b(satanic|demonic|curse you|go to hell|hate church)\b/gi,
   reason: 'Contains language that conflicts with community values.',
  },
]

function scanField(field: ModerationField): ModerationIssue[] {
  const issues: ModerationIssue[] = []
  const normalized = field.text.toLowerCase()

  for (const rule of BLOCK_RULES) {
    rule.pattern.lastIndex = 0
    const match = rule.pattern.exec(normalized)
    if (match) {
      const snippet = field.text.slice(Math.max(0, match.index - 10), Math.min(field.text.length, match.index + match[0].length + 10))
      issues.push({
        field: field.label,
        snippet: snippet.trim(),
        reason: rule.reason,
      })
    }
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
