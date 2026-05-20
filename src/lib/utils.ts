export function generateSlug(text: string): string {
  if (!text) return ''
  
  return text
    .toLowerCase()
    // 공백을 하이픈으로 변경
    .replace(/\s+/g, '-')
    // 영소문자, 숫자, 하이픈이 아닌 문자 제거 (한글 등)
    // 한글은 그대로 두어 사용자가 직접 영문으로 바꾸게 유도하라는 지침이 있으나,
    // 정규식 허용 문자 외 제거 로직에서 한글도 지워질 수 있음.
    // 하지만 "영문 입력: 소문자 변환 + 공백 하이픈 + 특수문자 제거", 
    // "한글 입력: 관리자가 직접 영문 slug 입력하도록 빈칸 유지" 지침에 따라 
    // 기본적으로 알파벳과 숫자만 남깁니다.
    .replace(/[^a-z0-9-]/g, '')
    // 연속된 하이픈 단일화
    .replace(/-+/g, '-')
    // 앞뒤 하이픈 제거
    .replace(/^-+|-+$/g, '')
}

export function validateSlug(slug: string): { valid: boolean; message?: string } {
  if (!slug.trim()) return { valid: false, message: '슬러그를 입력해주세요.' }
  if (/[가-힣]/.test(slug)) return { valid: false, message: '영문, 숫자, 하이픈(-)만 사용 가능합니다.' }
  if (!/^[a-z0-9]/.test(slug)) return { valid: false, message: '영문 소문자 또는 숫자로 시작해야 합니다.' }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) return { valid: false, message: '영문 소문자, 숫자, 하이픈만 사용하세요.' }
  return { valid: true }
}
