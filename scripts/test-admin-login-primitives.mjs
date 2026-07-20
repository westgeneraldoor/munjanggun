import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const login = readFileSync('src/app/admin/login/page.tsx', 'utf8')
const styles = readFileSync('src/app/admin/login/login.module.css', 'utf8')

assert.match(login, /import \{ PlatformButton \}/, 'admin login must use the shared button')
assert.match(login, /import \{ PlatformField \}/, 'admin login must use the shared field')
assert.match(login, /import \{ PlatformStatePanel \}/, 'admin login must use the shared error state')
assert.doesNotMatch(login, /<input\b/, 'admin login must not define raw inputs')
assert.doesNotMatch(login, /<button\b/, 'admin login must not define a raw submit button')
assert.match(login, /<PlatformStatePanel[\s\S]*?tone="error"/, 'authentication failures must use the shared assertive error state')
assert.match(login, /autoComplete="email"/, 'email input must expose its autocomplete purpose')
assert.match(login, /autoComplete="current-password"/, 'password input must expose its autocomplete purpose')
assert.doesNotMatch(styles, /height:\s*36px/, 'desktop login must not shrink the submit button below the shared minimum')

console.log('admin login primitive contract passed')
