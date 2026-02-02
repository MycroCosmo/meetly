<template>
  <div class="room-page">
    <!-- ✅ 로딩 -->
    <div v-if="loading" class="loading">
      <p>로딩 중...</p>
    </div>

    <div v-else-if="errorMessage" class="error">
      <p>{{ errorMessage }}</p>
      <NuxtLink to="/create" class="btn-link">새 모임 만들기</NuxtLink>
    </div>

    <!-- ✅ room은 있는데 participant가 없으면: 닉네임 입력 단계 -->
    <div v-else-if="room && !participant" class="join-container">
      <header class="room-header">
        <!-- ✅ 홈으로(좌상단) -->
        <button
          class="btn-back"
          type="button"
          @click="goHome"
          aria-label="홈으로"
          title="홈으로"
        >
          <!-- left arrow -->
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.7 6.3a1 1 0 0 1 0 1.4L10.41 12l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.41 0z"
            />
          </svg>
        </button>

        <h1 class="room-title">{{ room.title }}</h1>
        <p v-if="room.description" class="description">{{ room.description }}</p>

        <!-- ✅ 방 코드(인라인 복사 버튼) + 우측 공유 버튼 -->
        <div class="room-code-row">
          <div class="room-code-inline">
            <p class="room-code">
              방 코드: <strong>{{ room.code }}</strong>
            </p>

            <!-- ✅ 방 코드 복사는 코드 옆 -->
            <button
              class="btn-icon"
              type="button"
              :disabled="!room?.code"
              @click="copyRoomCode"
              aria-label="방 코드 복사"
              title="방 코드 복사"
            >
              <!-- copy icon -->
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"
                />
              </svg>
            </button>
          </div>

          <div class="room-actions">
            <!-- ✅ 주소 복사는 공유 아이콘으로 우측에 유지 -->
            <button
              class="btn-icon btn-share"
              type="button"
              :disabled="!room?.code"
              @click="copyRoomLink"
              aria-label="방 주소 공유(복사)"
              title="방 주소 공유(복사)"
            >
              <!-- share icon -->
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18 16a3 3 0 0 0-2.4 1.2l-6.2-3.1a3.2 3.2 0 0 0 0-2.2l6.2-3.1A3 3 0 1 0 15 6a3 3 0 0 0 .1.7L9 9.8a3 3 0 1 0 0 4.4l6.1 3.1A3 3 0 1 0 18 16z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- ✅ 방 코드 아래: 방 소속 인원 수 -->
        <div class="room-meta-sub">
          <span class="member-count">
            참여 인원: <strong>{{ memberCountText }}</strong>
          </span>
        </div>
      </header>

      <div class="join-card">
        <h2 class="join-title">닉네임을 입력하세요</h2>

        <input
          v-model="nicknameInput"
          class="join-input"
          placeholder="예: 이안"
          maxlength="20"
          @keyup.enter="confirmJoin"
        />

        <p v-if="joinError" class="join-error">{{ joinError }}</p>

        <button
          class="btn-primary"
          :disabled="joining || !nicknameInput.trim()"
          @click="confirmJoin"
        >
          {{ joining ? '입장 처리 중...' : '입장' }}
        </button>
      </div>
    </div>

    <!-- ✅ room + participant 확보되면 정상 UI -->
    <div v-else-if="room && participant" class="room-container">
      <header class="room-header">
        <button
          class="btn-back"
          type="button"
          @click="goHome"
          aria-label="홈으로"
          title="홈으로"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.7 6.3a1 1 0 0 1 0 1.4L10.41 12l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.41 0z"
            />
          </svg>
        </button>

        <h1 class="room-title">{{ room.title }}</h1>
        <p v-if="room.description" class="description">{{ room.description }}</p>

        <div class="room-code-row">
          <div class="room-code-inline">
            <p class="room-code">
              방 코드: <strong>{{ room.code }}</strong>
            </p>

            <button
              class="btn-icon"
              type="button"
              :disabled="!room?.code"
              @click="copyRoomCode"
              aria-label="방 코드 복사"
              title="방 코드 복사"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"
                />
              </svg>
            </button>
          </div>

          <div class="room-actions">
            <button
              class="btn-icon btn-share"
              type="button"
              :disabled="!room?.code"
              @click="copyRoomLink"
              aria-label="방 주소 공유(복사)"
              title="방 주소 공유(복사)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18 16a3 3 0 0 0-2.4 1.2l-6.2-3.1a3.2 3.2 0 0 0 0-2.2l6.2-3.1A3 3 0 1 0 15 6a3 3 0 0 0 .1.7L9 9.8a3 3 0 1 0 0 4.4l6.1 3.1A3 3 0 1 0 18 16z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="room-meta-sub">
          <span class="member-count">
            참여 인원: <strong>{{ memberCountText }}</strong>
          </span>
        </div>
      </header>

      <nav class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-button', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <main class="tab-content">
        <TimeTab v-if="activeTab === 'time'" :room="room" :participant="participant" @refresh-room="refreshRoom" />
        <PlacesTab v-if="activeTab === 'places'" :room="room" :participant="participant" @refresh-room="refreshRoom" />
        <SummaryTab v-if="activeTab === 'summary'" :room="room" :participant="participant" />
        <ExpensesTab v-if="activeTab === 'expenses'" :room="room" :participant="participant" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: '모임 참여 - Meetly',
  description: '그룹 모임에 참여하여 시간, 장소, 비용을 함께 계획하세요.',
  robots: 'noindex, nofollow', // 검색 엔진에 노출하지 않음
  ogTitle: '모임 참여 - Meetly',
  ogDescription: '그룹 모임에 참여하여 시간, 장소, 비용을 함께 계획하세요.',
  ogImage: '/og-image.svg',
  twitterCard: 'summary_large_image'
})

import type { Room, Participant } from '~/composables/useRoom'
import { useToast } from '~/composables/useToast'

const toast = useToast()

type TabId = 'time' | 'places' | 'summary' | 'expenses'

const route = useRoute()
const router = useRouter()
const code = route.params.code as string

const supabase = useSupabase()
const { getRoomByCode, joinRoom, getParticipantToken, setParticipantToken } = useRoom()

// ✅ 중요: 해시 사용 제거 (create-room이 token_hash에 "원문 토큰" 저장하는 구조와 맞춤)
const { getOrCreateToken } = useParticipantToken()

const room = ref<Room | null>(null)
const participant = ref<Participant | null>(null)
const loading = ref(true)
const errorMessage = ref<string>('')

const joining = ref(false)
const joinError = ref('')
const nicknameInput = ref('')

const { start: pageStart, end: pageEnd } = usePageLoading()

const memberCount = ref<number | null>(null)
const memberCountText = computed(() => {
  if (memberCount.value === null) return '-'
  return `${memberCount.value}명`
})

const activeTab = ref<TabId>('time')
const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'time', label: '시간' },
  { id: 'places', label: '장소' },
  { id: 'summary', label: '요약' },
  { id: 'expenses', label: '비용' }
]

const getErrorMessage = (e: unknown, fallback: string) => {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as any).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

// ✅ RLS 컨텍스트는 "원문 토큰"으로 주입
const setRlsContext = async (token: string) => {
  if (!import.meta.client) return
  if (!token || !token.trim()) return
  await supabase.rpc('set_participant_token_context', { token })
}

// ✅ SHA256 hash function
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ✅ userId가 있으면 user_id로, 없으면 token_hash(=sha256(원문 토큰))로 참가자 찾기
const getParticipantMaybe = async (roomId: string, token: string, userId?: string) => {
  const query = supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)

  if (userId !== undefined) {
    query.eq('user_id', userId)
  } else {
    // ✅ token을 hash 처리해야 DB의 token_hash와 비교됨
    const tokenHash = await sha256Hex(token)
    query.eq('token_hash', tokenHash)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return (data ?? null) as Participant | null
}

const fetchMemberCount = async (roomId: string) => {
  const { count, error } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)

  if (error) throw error
  memberCount.value = count ?? 0
}

const loadRoom = async () => {
  loading.value = true
  errorMessage.value = ''
  joinError.value = ''
  memberCount.value = null
  pageStart()

  try {
    const roomData = (await getRoomByCode(code)) as Room | null
    if (!roomData) {
      errorMessage.value = '모임을 찾을 수 없습니다'
      return
    }

    const expireAt = new Date(roomData.expire_at)
    if (!Number.isFinite(expireAt.getTime())) {
      errorMessage.value = '만료 날짜 형식이 올바르지 않습니다'
      return
    }
    if (expireAt < new Date()) {
      errorMessage.value = '이 모임은 만료되었습니다'
      return
    }

    room.value = roomData
    await fetchMemberCount(roomData.id)

    // 로그인 사용자 여부 (있으면 user_id 우선)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id

    // ✅ 토큰은 "room-scoped"로 저장되어 있음
    // 1) 이미 저장된 토큰이 있으면 사용
    let token = getParticipantToken(roomData.id)
    
    // 2) 없으면 새로 생성 (다른 방에서 온 경우)
    if (!token) {
      token = getOrCreateToken()
      if (!token) {
        errorMessage.value = '참여 토큰을 생성할 수 없습니다'
        return
      }
      setParticipantToken(roomData.id, token)
    }

    if (!token) {
      errorMessage.value = '참여 토큰을 생성할 수 없습니다'
      return
    }

    // ✅ 컨텍스트 주입 후 조회 (RLS가 있으면 이 순서가 필수)
    await setRlsContext(token)

    const existing = await getParticipantMaybe(roomData.id, token, userId)
    if (existing) {
      participant.value = existing
      return
    }

    // 닉네임 기본값(이전 입력값)
    if (import.meta.client) {
      const pending = sessionStorage.getItem(`pendingNickname:${code}`)
      if (pending && !nicknameInput.value) {
        nicknameInput.value = pending
        sessionStorage.removeItem(`pendingNickname:${code}`)
      } else {
        const saved = localStorage.getItem(`roomNickname:${roomData.id}`)
        if (saved && !nicknameInput.value) nicknameInput.value = saved
      }
    }
  } catch (e) {
    errorMessage.value = getErrorMessage(e, '모임을 불러올 수 없습니다')
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
    pageEnd()
  }
}

const confirmJoin = async () => {
  joinError.value = ''
  if (!room.value) return

  const nickname = nicknameInput.value.trim()
  if (!nickname) {
    joinError.value = '닉네임을 입력하세요'
    return
  }

  joining.value = true
  try {
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id

    // ✅ room-scoped 토큰 사용
    let token = getParticipantToken(room.value.id)
    if (!token) {
      token = getOrCreateToken()
      if (!token) {
        joinError.value = '참여 토큰을 생성할 수 없습니다'
        return
      }
      setParticipantToken(room.value.id, token)
    }

    await setRlsContext(token)

    // ✅ 이미 참가자인지 재확인(중복 생성 방지)
    const existing = await getParticipantMaybe(room.value.id, token, userId)
    if (existing) {
      participant.value = existing
      return
    }

    // ✅ joinRoom에 token을 그대로 전달 (token_hash 컬럼에 원문 저장)
    const joined = await joinRoom(room.value.id, nickname, token)
    participant.value = joined

    if (import.meta.client) {
      localStorage.setItem(`roomNickname:${room.value.id}`, nickname)
    }

    memberCount.value = (memberCount.value ?? 0) + 1
  } catch (e) {
    joinError.value = getErrorMessage(e, '입장에 실패했습니다')
    if (import.meta.dev) console.error(e)
  } finally {
    joining.value = false
  }
}

const writeClipboard = async (text: string, successMsg: string) => {
  const v = String(text ?? '').trim()
  if (!v) return

  try {
    await navigator.clipboard.writeText(v)
    toast.success(successMsg)
  } catch {
    toast.error('복사에 실패했습니다. 길게 눌러 복사해주세요')
  }
}

const copyRoomCode = async () => {
  await writeClipboard(room.value?.code ?? '', '방 코드가 복사되었습니다')
}

const copyRoomLink = async () => {
  if (!import.meta.client) return
  await writeClipboard(window.location.href, '방 주소가 복사되었습니다')
}

const refreshRoom = async () => {
  if (!room.value) return
  
  try {
    const roomData = await getRoomByCode(code)
    if (roomData) {
      room.value = roomData
    }
  } catch (e) {
    console.error('Failed to refresh room:', e)
  }
}

const goHome = async () => {
  if (route.path === '/') return
  
  if (!confirm('정말로 홈으로 돌아가시겠습니까?\n(작성 중인 내용이 저장되지 않을 수 있습니다)')) {
    return
  }
  
  await router.push('/')
}

onMounted(loadRoom)
</script>

<style scoped>
.room-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
}

.error {
  color: #c33;
}

.btn-link {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
}

.room-container {
  max-width: 100%;
}

.room-header {
  position: relative;
  background: white;
  padding: 1.5rem;
  padding-left: 3.25rem;
  border-bottom: 1px solid #eee;
}

.btn-back {
  position: absolute;
  top: 14px;
  left: 12px;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s, border-color 0.15s;
}

.btn-back:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.btn-back:active {
  transform: translateY(1px);
}

.room-title {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.description {
  color: #666;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.room-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.room-code-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.room-code {
  color: #888;
  font-size: 0.85rem;
  margin: 0;
  white-space: nowrap;
}

.room-code strong {
  color: #007bff;
  font-weight: 800;
}

.room-actions {
  display: flex;
  gap: 0.35rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 10px;
  cursor: pointer;
  color: #374151;
  transition: background 0.15s, transform 0.05s, border-color 0.15s;
}

.btn-icon:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.btn-icon:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-icon:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-share {
  background: #eef2ff;
  border-color: #dbeafe;
  color: #1d4ed8;
}

.btn-share:hover:not(:disabled) {
  background: #e0e7ff;
  border-color: #c7d2fe;
}

.room-meta-sub {
  margin-top: 0.35rem;
  color: #6b7280;
  font-size: 0.85rem;
}

.member-count strong {
  color: #111827;
  font-weight: 800;
}

.tab-nav {
  display: flex;
  background: white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 10;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab-button {
  flex: 1;
  padding: 1rem;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-button.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.tab-content {
  padding: 1rem;
  min-height: calc(100vh - 200px);
}

.join-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.join-card {
  background: white;
  margin: 1rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #eee;
}

.join-title {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  color: #333;
}

.join-input {
  width: 100%;
  padding: 0.9rem 0.9rem;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 1rem;
  outline: none;
}

.join-error {
  margin-top: 0.5rem;
  color: #c33;
  font-size: 0.9rem;
}

.btn-primary {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.9rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .room-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .room-header {
    padding: 2rem;
    padding-left: 3.75rem;
  }

  .tab-content {
    padding: 2rem;
  }

  .join-card {
    max-width: 520px;
    margin: 2rem auto;
  }
}
</style>
