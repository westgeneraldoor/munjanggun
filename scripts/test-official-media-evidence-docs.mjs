import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const [readiness, checklist, routine] = await Promise.all([
  source('docs/platform/BLOG_PRODUCTION_READINESS.md'),
  source('docs/platform/CONTENT_OS_OPERATION_CHECKLIST.md'),
  source('docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md'),
])

const readinessDate = readiness.match(/최종 갱신: (\d{4}-\d{2}-\d{2})/)?.[1]
assert.ok(readinessDate && readinessDate >= '2026-07-20', 'readiness evidence must not predate the verified import')
assert.doesNotMatch(readiness, /사진 연결 수동 확인 대기/)
assert.match(readiness, /register-official-brand-asset\.mjs/)
assert.match(readiness, /실제 중앙 브랜드[^\n]*JPG 2건[^\n]*GIF 1건/)
assert.match(readiness, /reviewing[^\n]*발행하지 않/)
assert.match(readiness, /service[-_]role[^\n]*서버에서만/)
assert.match(readiness, /사람용 사진 업로드[^\n]*두 확인값[^\n]*업로드를 거부/)
assert.match(readiness, /official_reviewed[^\n]*홍보 동의[^\n]*false[^\n]*비공개 후보/)
assert.match(readiness, /reviewing[^\n]*service-role 전용 원자 RPC/)
assert.match(readiness, /Storage·메타데이터 등록[^\n]*보상 정리/)
assert.doesNotMatch(readiness, /공식 자산 등록·연결[^\n]*원자 RPC로만/)

assert.match(
  checklist,
  /blog-media-private[\s\S]*allowed_mime_types:[^\n]*image\/gif/,
)
assert.match(
  checklist,
  /blog-media\npublic: true[\s\S]*allowed_mime_types:[^\n]*image\/gif/,
)
assert.match(checklist, /JPG·PNG·WebP는 정적 WebP 파생본/)
assert.match(checklist, /GIF는 원본 `\.gif`와 `image\/gif`를 보존/)

const officialSection = checklist.slice(
  checklist.indexOf('## 13. Official central asset import and GIF verification'),
)
assert.ok(officialSection.startsWith('## 13.'), 'official central asset checklist must exist')
assert.doesNotMatch(officialSection, /^- \[ \] (?!실제 reviewing 원고의 production 발행)/m)
assert.match(officialSection, /- \[ \] 실제 reviewing 원고의 production 발행/)
assert.match(officialSection, /development-only public renderer regression[^\n]*2-frame/i)
assert.match(officialSection, /candidate[^\n]*not automatic public approval[^\n]*promotion consent[^\n]*media approval/i)
assert.doesNotMatch(officialSection, /Candidate or unresolved-claim central media is rejected/)

assert.match(routine, /`privacyStatus = official_reviewed`/)
assert.match(routine, /register-official-brand-asset\.mjs/)
assert.match(routine, /관리자 UI와 Codex 서버 명령은 같은 원본 검증 모듈/)
assert.match(routine, /검증·권한·감사·발행 승격 경계를 우회/)

console.log('official media evidence documentation contract passed')
