// composables/useRlsContext.ts
export const useRlsContext = () => {
  const supabase = useSupabase()
  const { getToken, getOrCreateToken } = useParticipantToken()

  /**
   * Supabase RLS 컨텍스트(token) 주입
   * - SSR에서는 아무 것도 하지 않음
   * - 토큰이 없으면 생성 시도 후, 있으면 RPC 호출
   * - 빈 문자열/undefined로 RPC 호출하지 않도록 방어
   */
  const setRlsContextIfPossible = async (): Promise<void> => {
    if (!import.meta.client) return

    const token = getToken() ?? getOrCreateToken()
    if (!token || !token.trim()) return

    await supabase.rpc('set_participant_token_context', { token })
  }

  return { setRlsContextIfPossible }
}
