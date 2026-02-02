// composables/useRoom.ts
export type Room = {
  id: string
  code: string
  title: string
  description: string | null
  expire_at: string
  owner_user_id: string | null
  owner_participant_id: string | null
  finalized_time_start: string | null
  finalized_time_end: string | null
  finalized_place_id: string | null
  created_at?: string
  date_start?: string | null
  date_end?: string | null
}

export type Participant = {
  id: string
  room_id: string
  nickname: string
  token_hash: string | null
  user_id: string | null
  created_at?: string
  anytime_ok?: boolean
}

type CreateRoomResult = {
  room_id: string
  room_code: string
  participant_id: string
  participant_token: string // ✅ raw token
}

export const useRoom = () => {
  const supabase = useSupabase()

  // =========================
  // Token Storage (room-scoped)
  // =========================
  const tokenKey = (roomId: string) => `participantToken_${roomId}`

  const setParticipantToken = (roomId: string, token: string) => {
    if (!import.meta.client) return
    localStorage.setItem(tokenKey(roomId), token)
  }

  const getParticipantToken = (roomId: string): string | null => {
    if (!import.meta.client) return null

    // ✅ 1) 신규 키
    const v = localStorage.getItem(tokenKey(roomId))
    if (v) return v

    // ✅ 2) 레거시 키(이전 버전에서 participantToken 하나만 쓰던 경우) 마이그레이션
    const legacy = localStorage.getItem('participantToken')
    if (legacy) {
      localStorage.setItem(tokenKey(roomId), legacy)
      return legacy
    }

    return null
  }

  // =========================
  // Hash utils (browser)
  // =========================
  async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // =========================
  // RLS context (rpc expects RAW TOKEN)
  // =========================
  const setRlsContext = async (token: string | null): Promise<void> => {
    if (!import.meta.client) return
    if (!token || !token.trim()) return
    await supabase.rpc('set_participant_token_context', { token })
  }

  // =========================
  // Basic fetchers
  // =========================
  const getRoomById = async (roomId: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle()

    if (error) throw error
    return (data as Room) ?? null
  }

  const getRoomByCode = async (code: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (error) throw error
    return (data as Room) ?? null
  }

  const getParticipantById = async (participantId: string): Promise<Participant | null> => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .maybeSingle()

    if (error) throw error
    return (data as Participant) ?? null
  }

  // ✅ DB는 token_hash로 저장되어 있으므로, 조회는 token_hash 기준으로만 해야 함
  const getParticipantByTokenHash = async (
  roomId: string,
  tokenHash: string
): Promise<Participant | null> => {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw error
  return (data as Participant) ?? null
}

  // =========================
  // Create room (Edge Function creates room + host participant)
  // =========================
  const createRoom = async (
    title: string,
    description: string,
    hostNickname: string
  ): Promise<{ room: Room; participant: Participant; token: string }> => {
    const { data, error } = await supabase.functions.invoke<CreateRoomResult>('create-room', {
      body: {
        title,
        description: description || null,
        nickname: hostNickname
      }
    })

    if (error) throw error
    if (!data?.room_id || !data?.participant_id || !data?.participant_token) {
      throw new Error('create-room returned invalid payload')
    }

    // ✅ raw token 저장
    setParticipantToken(data.room_id, data.participant_token)

    // ✅ rpc는 raw token을 기대함
    await setRlsContext(data.participant_token)

    const room = await getRoomById(data.room_id)
    if (!room) throw new Error('room not found after create')

    // ✅ 참가자는 participant_id로 조회 (raw token으로 token_hash 조회하면 절대 못 찾음)
    const participant = await getParticipantById(data.participant_id)
    if (!participant) throw new Error('participant not found after create')

    return { room, participant, token: data.participant_token }
  }

  // =========================
  // Join room (client-side join)
  // - IMPORTANT: token is RAW TOKEN
  // - We store RAW TOKEN to localStorage
  // - We store token_hash = sha256(token) to DB
  // =========================
  const joinRoom = async (
  roomId: string,
  nickname: string,
  token: string // ✅ 원문 token
): Promise<Participant> => {
  if (!token) throw new Error('token is required')

  // ✅ 원문 토큰을 room별로 저장 (이 토큰을 finalize-place에도 그대로 보냄)
  setParticipantToken(roomId, token)

  // RLS 컨텍스트는 "원문 token"을 주입하는 정책이면 그대로 둠
  await setRlsContext(token)

  // ✅ DB에는 hash로 저장해야 finalize-place가 찾을 수 있음
  const tokenHash = await sha256Hex(token)

  // ✅ 중복 방지: token_hash로 조회
  const existing = await getParticipantByTokenHash(roomId, tokenHash)
  if (existing) return existing

  const { data, error } = await supabase
    .from('participants')
    .insert({
      room_id: roomId,
      nickname,
      token_hash: tokenHash,
      user_id: null,
      // anytime_ok: false, // NOT NULL이고 default 없으면 켜세요
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Participant
}

  // =========================
  // Host check (rooms.owner_participant_id)
  // =========================
  const isHost = (room: Room | null, me: Participant | null) => {
    if (!room || !me) return false
    return (room.owner_participant_id ?? null) === me.id
  }

  // =========================
  // Finalize (Edge Functions expect RAW TOKEN in body.token)
  // =========================
  const finalizeTime = async (roomId: string, startAt: string, endAt: string): Promise<Room> => {
    const token = getParticipantToken(roomId)
    if (!token) throw new Error('participantToken is missing')

    const { data, error } = await supabase.functions.invoke<{ room: Room }>('finalize-time', {
      body: { room_id: roomId, start_at: startAt, end_at: endAt, token } // ✅ raw token
    })

    if (error) throw error
    if (!data?.room) throw new Error('finalize-time returned invalid payload')
    return data.room
  }

  const finalizePlace = async (roomId: string, placeId: string): Promise<Room> => {
    const token = getParticipantToken(roomId)
    if (!token) throw new Error('participantToken is missing')

    const { data, error } = await supabase.functions.invoke<{ room: Room }>('finalize-place', {
      body: { room_id: roomId, place_id: placeId, token } // ✅ raw token
    })

    if (error) throw error
    if (!data?.room) throw new Error('finalize-place returned invalid payload')
    return data.room
  }

  return {
    // tokens
    setParticipantToken,
    getParticipantToken,

    // room
    createRoom,
    getRoomById,
    getRoomByCode,

    // participant
    joinRoom,
    getParticipantById,
    getParticipantByTokenHash,

    // host
    isHost,

    // finalize
    finalizeTime,
    finalizePlace
  }
}
