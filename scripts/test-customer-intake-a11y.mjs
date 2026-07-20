import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const measureForm = readFileSync('src/app/portal/measure/new/MeasureForm.tsx', 'utf8')
const asForm = readFileSync('src/app/portal/as/new/AsForm.tsx', 'utf8')

assert.ok(
  measureForm.includes('role="group" aria-label="연락받을 사람 선택"'),
  'the contact choice must expose a button group instead of radio semantics',
)
assert.ok(!measureForm.includes('role="radiogroup"'), 'plain buttons must not be presented as a radio group')
assert.equal(
  (measureForm.match(/aria-pressed=\{/g) ?? []).length >= 2,
  true,
  'both contact choice buttons must expose their selected state',
)

assert.ok(
  asForm.includes('className={styles.errorText} role="alert">{fileError}'),
  'file validation errors must be announced immediately',
)
assert.ok(
  asForm.includes('className={styles.errorText} role="alert">{submitError}'),
  'submission errors must be announced immediately',
)

console.log('customer intake accessibility contract passed')
