export type BlogClaimStatus =
  | 'publishable'
  | 'vetted'
  | 'candidate'
  | 'needs_confirmation'
  | 'restricted'
  | 'expired'

export type BlogClaimSafetyMode = 'draft' | 'ready' | 'publish'

export type BlogClaimSafetyIssue = {
  code: string
  message: string
  severity: 'blocker' | 'warning'
  evidenceRef?: string
}

export type BlogClaimSafetyResult = {
  passed: boolean
  status: 'passed' | 'warning' | 'blocked'
  evidenceCount: number
  blockers: string[]
  warnings: string[]
  issues: BlogClaimSafetyIssue[]
  forbiddenTerms: string[]
}

export type BlogClaimSafetyInput = {
  mode?: BlogClaimSafetyMode
  title?: string | null
  textSegments?: Array<string | null | undefined>
  sourceEvidence: unknown
  brandCheckResult?: unknown
}

type EvidenceRecord = Record<string, unknown>

const BLOCKED_CLAIM_STATUSES = new Set<BlogClaimStatus>(['needs_confirmation', 'restricted', 'expired'])
const SAFE_CLAIM_STATUSES = new Set<BlogClaimStatus>(['publishable', 'vetted'])
const VOLATILE_CLAIM_TYPES = new Set([
  'price',
  'discount',
  'installment',
  'review_count',
  'review',
  'schedule',
  'as',
  'warranty',
  'travel_fee',
  'service_area',
  'event',
])

const FORBIDDEN_COPY_RULES: Array<{ code: string; term: string; pattern: RegExp; message: string }> = [
  {
    code: 'fixed_price_claim',
    term: '가격 확정',
    pattern: /최저가|확정가|전화로\s*확정\s*견적|추가(?:금|비용)\s*(?:없음|없는|없이)/i,
    message: '가격, 견적, 추가금 확정 표현은 발행할 수 없습니다.',
  },
  {
    code: 'absolute_possibility_claim',
    term: '무조건 가능',
    pattern: /무조건\s*가능|100\s*%|100퍼센트|반드시\s*가능/i,
    message: '현장 확인 없이 시공 가능 여부를 단정할 수 없습니다.',
  },
  {
    code: 'absolute_warranty_claim',
    term: '무조건 무상/평생 보증',
    pattern: /무조건\s*무상|평생\s*보증|AS\s*평생|A\/S\s*평생/i,
    message: 'A/S와 보증은 기간, 범위, 예외 조건 없이 단정할 수 없습니다.',
  },
  {
    code: 'unsupported_review_claim',
    term: '리뷰 수 1위/만족도 100',
    pattern: /리뷰\s*수\s*1위|고객\s*만족\s*100|만족도\s*100/i,
    message: '리뷰 수나 만족도는 최신 근거 없이 우위 표현으로 발행할 수 없습니다.',
  },
  {
    code: 'cleaning_service_claim',
    term: '청소/먼지/소음 단정',
    pattern: /보양\s*작업\s*후\s*청소|먼지\s*(?:없음|없는)|소음\s*(?:없음|없는)/i,
    message: '청소, 먼지, 소음 없음 표현은 확정 서비스처럼 발행할 수 없습니다.',
  },
]

const KNOWN_PUBLIC_CONTACTS = new Set(['1599-6065'])

function isRecord(value: unknown): value is EvidenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStatus(value: unknown): BlogClaimStatus | null {
  const status = asString(value)
  if (
    status === 'publishable' ||
    status === 'vetted' ||
    status === 'candidate' ||
    status === 'needs_confirmation' ||
    status === 'restricted' ||
    status === 'expired'
  ) {
    return status
  }
  return null
}

function normalizeEvidenceArray(value: unknown): EvidenceRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord)
}

function evidenceString(evidence: EvidenceRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = asString(evidence[key])
    if (value) return value
  }
  return ''
}

function evidenceStatus(evidence: EvidenceRecord) {
  return normalizeStatus(evidence.status ?? evidence.claim_status ?? evidence.claimStatus ?? evidence.usageStatus ?? evidence.usage_status)
}

function evidenceRef(evidence: EvidenceRecord) {
  return evidenceString(evidence, 'claim_id', 'claimId', 'proof_id', 'proofId', 'asset_id', 'assetId', 'source_id', 'sourceId', 'ref')
}

function evidenceStringArray(evidence: EvidenceRecord, ...keys: string[]) {
  const values: string[] = []

  for (const key of keys) {
    const value = evidence[key]
    if (Array.isArray(value)) {
      values.push(...value.map(asString).filter(Boolean))
      continue
    }

    const scalar = asString(value)
    if (scalar) values.push(scalar)
  }

  return values
}

function normalizeClaimTypeToken(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/^claim[_-]?type:/, '')
}

function evidenceClaimTypes(evidence: EvidenceRecord) {
  return [
    ...evidenceStringArray(evidence, 'claim_type', 'claimType', 'type'),
    ...evidenceStringArray(evidence, 'claim_types', 'claimTypes', 'tags'),
  ]
    .flatMap(value => value.split(/[\s,]+/))
    .map(normalizeClaimTypeToken)
    .filter(Boolean)
}

function evidenceClaimRisk(evidence: EvidenceRecord) {
  return evidenceString(evidence, 'claim_risk', 'claimRisk').toLocaleLowerCase('ko-KR')
}

function hasFreshnessMarker(evidence: EvidenceRecord) {
  return Boolean(evidenceString(evidence, 'checked_at', 'checkedAt', 'basis_date', 'basisDate', 'verified_at', 'verifiedAt'))
}

function isExternalMode(mode: BlogClaimSafetyMode) {
  return mode === 'ready' || mode === 'publish'
}

function addIssue(
  issues: BlogClaimSafetyIssue[],
  severity: BlogClaimSafetyIssue['severity'],
  code: string,
  message: string,
  evidence?: EvidenceRecord,
) {
  issues.push({
    severity,
    code,
    message,
    evidenceRef: evidence ? evidenceRef(evidence) || undefined : undefined,
  })
}

function evidenceTextForScan(evidenceRows: EvidenceRecord[]) {
  return evidenceRows.flatMap(evidence => (
    [
      evidence.note,
      evidence.quote,
      evidence.raw_text,
      evidence.rawText,
      evidence.customer_phone,
      evidence.customerPhone,
      evidence.phone,
      evidence.address,
      evidence.detail_address,
      evidence.detailAddress,
      evidence.original_review,
      evidence.originalReview,
      evidence.consultation_transcript,
      evidence.consultationTranscript,
    ]
  ))
}

function textForScan(input: BlogClaimSafetyInput, evidenceRows: EvidenceRecord[]) {
  return [input.title, ...(input.textSegments ?? []), ...evidenceTextForScan(evidenceRows)]
    .map(asString)
    .filter(Boolean)
    .join('\n')
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  if (digits.startsWith('01') && digits.length >= 10) return digits
  return value
}

function collectForbiddenCopyIssues(input: BlogClaimSafetyInput, evidenceRows: EvidenceRecord[], issues: BlogClaimSafetyIssue[]) {
  const text = textForScan(input, evidenceRows)
  const forbiddenTerms: string[] = []

  for (const rule of FORBIDDEN_COPY_RULES) {
    if (!rule.pattern.test(text)) continue
    forbiddenTerms.push(rule.term)
    addIssue(issues, 'blocker', rule.code, rule.message)
  }

  const phoneMatches = text.match(/(?:01[016789]-?\d{3,4}-?\d{4}|1[5-8]\d{2}-?\d{4})/g) ?? []
  const privatePhoneMatches = phoneMatches.filter(match => !KNOWN_PUBLIC_CONTACTS.has(normalizePhone(match)))
  if (privatePhoneMatches.length > 0) {
    forbiddenTerms.push('개인 전화번호')
    addIssue(issues, 'blocker', 'private_phone', '고객 또는 개인 전화번호로 보이는 정보는 공개 글에 넣을 수 없습니다.')
  }

  if (/(?:\d{1,4}동\s*\d{1,4}호|동호수|[가-힣A-Za-z0-9]+(?:로|길)\s*\d{1,4}(?:-\d{1,4})?)/.test(text)) {
    forbiddenTerms.push('상세 주소')
    addIssue(issues, 'blocker', 'private_address', '상세 주소나 동호수로 보이는 정보는 공개 글에 넣을 수 없습니다.')
  }

  return forbiddenTerms
}

function collectBrandCheckIssues(brandCheckResult: unknown, issues: BlogClaimSafetyIssue[]) {
  if (!isRecord(brandCheckResult)) return

  const status = asString(brandCheckResult.status)
  const blockers = Array.isArray(brandCheckResult.blockers) ? brandCheckResult.blockers : []
  const forbiddenTerms = Array.isArray(brandCheckResult.forbidden_terms) ? brandCheckResult.forbidden_terms : []
  const prohibitedTerms = Array.isArray(brandCheckResult.prohibited_terms) ? brandCheckResult.prohibited_terms : []

  if (
    brandCheckResult.passed === false ||
    status === 'failed' ||
    status === 'blocked' ||
    blockers.length > 0 ||
    forbiddenTerms.length > 0 ||
    prohibitedTerms.length > 0
  ) {
    addIssue(issues, 'blocker', 'brand_check_blocked', '기존 브랜드 검수 결과에 blocker 또는 금지 표현이 남아 있습니다.')
  }
}

function collectEvidenceIssues(mode: BlogClaimSafetyMode, evidenceRows: EvidenceRecord[], issues: BlogClaimSafetyIssue[]) {
  if (evidenceRows.length === 0) {
    addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'missing_source_evidence', '출처 근거가 필요합니다.')
    return
  }

  for (const evidence of evidenceRows) {
    const status = evidenceStatus(evidence)
    const ref = evidenceRef(evidence)
    const claimTypes = evidenceClaimTypes(evidence)
    const claimRisk = evidenceClaimRisk(evidence)
    const volatileClaim = claimTypes.some(claimType => VOLATILE_CLAIM_TYPES.has(claimType))

    if (!ref) {
      addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'evidence_missing_ref', '근거에는 claim_id, proof_id, asset_id, source_id 또는 ref가 필요합니다.', evidence)
    }

    if (!status) {
      addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'claim_status_missing', '공개 검수 근거에는 publishable/vetted 등 명시적인 claim 상태값이 필요합니다.', evidence)
    }

    if (status && BLOCKED_CLAIM_STATUSES.has(status)) {
      addIssue(issues, 'blocker', `claim_status_${status}`, `${status} 상태인 claim은 공개 초안/발행 게이트를 통과할 수 없습니다.`, evidence)
      continue
    }

    if (status === 'candidate' && isExternalMode(mode)) {
      addIssue(issues, 'blocker', 'claim_status_candidate', 'candidate claim은 외부 발행 전 최신성 또는 사용 범위 확인이 필요합니다.', evidence)
      continue
    }

    if (volatileClaim && !status) {
      addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'volatile_claim_missing_status', '가격, 리뷰, 일정, A/S, 출장비, 이벤트 claim은 상태값이 필요합니다.', evidence)
    }

    if (volatileClaim && status && SAFE_CLAIM_STATUSES.has(status) && !hasFreshnessMarker(evidence)) {
      addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'volatile_claim_missing_checked_at', '변동 claim에는 기준일 또는 확인일을 남겨야 합니다.', evidence)
    }

    if (claimRisk === 'high' && (!status || !SAFE_CLAIM_STATUSES.has(status))) {
      addIssue(issues, isExternalMode(mode) ? 'blocker' : 'warning', 'high_risk_claim_not_cleared', '고위험 claim은 publishable/vetted 상태 확인 없이 사용할 수 없습니다.', evidence)
    }

    if (
      claimTypes.some(claimType => (
        claimType.includes('raw_review') ||
        claimType.includes('consultation_transcript') ||
        claimType.includes('customer_private')
      )) ||
      Boolean(asString(evidence.raw_text) || asString(evidence.rawText) || asString(evidence.original_review) || asString(evidence.originalReview) || asString(evidence.consultation_transcript) || asString(evidence.consultationTranscript))
    ) {
      addIssue(issues, 'blocker', 'private_source_type', '리뷰 원문, 상담 원문, 고객 개인정보 원본은 공개 글 근거로 직접 사용할 수 없습니다.', evidence)
    }
  }
}

export function validateBlogClaimSafety(input: BlogClaimSafetyInput): BlogClaimSafetyResult {
  const mode = input.mode ?? 'publish'
  const issues: BlogClaimSafetyIssue[] = []
  const evidenceRows = normalizeEvidenceArray(input.sourceEvidence)
  const forbiddenTerms = collectForbiddenCopyIssues(input, evidenceRows, issues)

  collectBrandCheckIssues(input.brandCheckResult, issues)
  collectEvidenceIssues(mode, evidenceRows, issues)

  const uniqueIssues = issues.filter((issue, index, array) => (
    array.findIndex(candidate => (
      candidate.code === issue.code &&
      candidate.message === issue.message &&
      candidate.evidenceRef === issue.evidenceRef
    )) === index
  ))
  const blockers = uniqueIssues.filter(issue => issue.severity === 'blocker').map(issue => issue.message)
  const warnings = uniqueIssues.filter(issue => issue.severity === 'warning').map(issue => issue.message)

  return {
    passed: blockers.length === 0,
    status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed',
    evidenceCount: evidenceRows.length,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    issues: uniqueIssues,
    forbiddenTerms: [...new Set(forbiddenTerms)],
  }
}
