// composables/useParticipantToken.ts
export const useParticipantToken = () => {
  // SSR에서는 빈 문자열로 통일 (호출부 타입 단순화)
  const getOrCreateToken = (): string => {
    if (!import.meta.client) return ''

    let token = localStorage.getItem('participantToken')
    if (!token) {
      const uuid = globalThis.crypto?.randomUUID?.()
      token = uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      localStorage.setItem('participantToken', token)
    }
    return token
  }

  const getToken = (): string | null => {
    if (!import.meta.client) return null
    return localStorage.getItem('participantToken')
  }

  const hashToken = async (token: string): Promise<string> => {
    if (!token) throw new Error('token is required')

    const subtle = globalThis.crypto?.subtle
    if (!subtle) throw new Error('WebCrypto subtle is not available')

    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await subtle.digest('SHA-256', data)

    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  return { getOrCreateToken, getToken, hashToken }
}
