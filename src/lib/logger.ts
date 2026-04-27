export function logError(message: string, error: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.error(message, error)
  }
  // 추후 Sentry 연동 시 이 함수에 추가
}
