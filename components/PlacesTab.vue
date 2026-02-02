<!-- PlacesTab.vue -->
<template>
  <div class="places-tab">
    <div class="section">
      <h2>장소 후보 추가</h2>

      <form @submit.prevent="handleAddPlace" class="place-form">
        <div class="form-group">
          <label>장소 이름 *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="예: 서울역 앞 스타벅스"
            required
            maxlength="255"
            :disabled="loading || isPlaceFinalized"
          />
        </div>

        <div class="form-group">
          <label>주소</label>
          <input
            v-model="form.address"
            type="text"
            placeholder="예: 서울특별시 중구 한강대로 405"
            maxlength="500"
            :disabled="loading || isPlaceFinalized"
          />
        </div>

        <div class="form-group">
          <label>URL (선택)</label>
          <input
            v-model="form.url"
            type="url"
            inputmode="url"
            placeholder="예: https://place.map.kakao.com/..."
            maxlength="1000"
            :disabled="loading || isPlaceFinalized"
          />
          <p class="help">
            네이버/카카오/구글 지도 링크 또는 매장 홈페이지 링크를 붙여넣으세요.
          </p>
        </div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="loading || isPlaceFinalized"
        >
          추가
        </button>

        <p v-if="isPlaceFinalized" class="hint hint-danger">
          - 장소가 이미 확정되어 후보 추가/투표가 불가능합니다. (조회만 가능)
        </p>
      </form>
    </div>

    <div class="section">
      <h2>장소 후보 및 투표</h2>

      <div v-if="candidates.length === 0" class="empty-state">
        아직 장소 후보가 없습니다.
      </div>

      <div v-else class="candidates-list">
        <div
          v-for="candidate in candidates"
          :key="candidate.id"
          class="candidate-item"
          :class="{ finalized: props.room.finalized_place_id === candidate.id }"
        >
          <div class="candidate-info">
            <h3>{{ candidate.name }}</h3>

            <p v-if="candidate.address" class="address">{{ candidate.address }}</p>

            <p v-if="candidate.url" class="url">
              <a :href="candidate.url" target="_blank" rel="noopener noreferrer">
                링크로 이동
              </a>
            </p>

            <p class="vote-count">투표: {{ getVoteCount(candidate.id) }}표</p>
          </div>

          <div class="candidate-actions">
            <!-- 투표 버튼: 확정되면 전부 막힘 -->
            <button
              v-if="props.room.finalized_place_id !== candidate.id"
              @click="handleVote(candidate.id)"
              class="btn-vote"
              :class="{ active: myVote === candidate.id }"
              :disabled="loading || isPlaceFinalized"
              type="button"
            >
              {{ myVote === candidate.id ? '투표함' : '투표' }}
            </button>

            <span v-else class="finalized-badge">확정</span>

            <!-- 방장 확정 버튼: 확정되면 안 보이게 -->
            <button
              v-if="canFinalize && !isPlaceFinalized && props.room.finalized_place_id !== candidate.id"
              @click="handleFinalize(candidate.id)"
              class="btn-finalize"
              :disabled="loading"
              type="button"
            >
              확정
            </button>
          </div>
        </div>
      </div>

      <p class="hint">
        - 확정은 <strong>방장만</strong> 가능합니다.
      </p>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Room, Participant } from '~/composables/useRoom'
import type { PlaceCandidate } from '~/types'
import { useToast } from '~/composables/useToast'

const toast = useToast()
const supabase = useSupabase()

const roomApi = useRoom()
const { getParticipantToken } = roomApi

const props = defineProps<{ room: Room; participant: Participant }>()
const emit = defineEmits<{
  (e: 'refresh-room'): void
}>()

/**
 * ✅ 장소 확정 여부
 */
const isPlaceFinalized = computed(() => !!props.room.finalized_place_id)

const form = reactive({
  name: '',
  address: '',
  url: ''
})

const candidates = ref<PlaceCandidate[]>([])
const voteCounts = ref<Record<string, number>>({})
const myVote = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

// =========================
// Host (방장) 판별
// =========================
const hostParticipantId = ref<string | null>(null)

const loadHost = async () => {
  const { data, error: err } = await supabase
    .from('participants')
    .select('id, created_at')
    .eq('room_id', props.room.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (err) throw err
  hostParticipantId.value = data?.id ?? null
}

const canFinalize = computed(() => hostParticipantId.value === props.participant.id)

// =========================
// Helpers
// =========================
const getVoteCount = (candidateId: string) => voteCounts.value[candidateId] || 0

const getRoomIdOrThrow = () => {
  const rid = props.room.id
  if (!rid) throw new Error('room.id is missing')
  return rid
}

const getParticipantIdOrThrow = () => {
  const pid = props.participant.id
  if (!pid) throw new Error('participant.id is missing')
  return pid
}

const normalizeUrlOrNull = (raw: string) => {
  const v = (raw ?? '').trim()
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

const setTokenContextIfExists = async () => {
  const roomId = props.room.id
  const token = getParticipantToken(roomId)
  if (token) {
    await supabase.rpc('set_participant_token_context', { token })
  }
}

// =========================
// Loaders
// =========================
const loadCandidates = async () => {
  const roomId = getRoomIdOrThrow()

  const { data, error: err } = await supabase
    .from('place_candidates')
    .select('id, room_id, name, address, url, created_at, created_by_participant_id')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })

  if (err) throw err
  candidates.value = (data ?? []) as PlaceCandidate[]
}

const loadVoteCounts = async () => {
  const roomId = getRoomIdOrThrow()

  const { data, error: err } = await supabase.rpc('get_place_vote_counts', {
    p_room_id: roomId
  })
  if (err) throw err

  const counts: Record<string, number> = {}
  ;(data ?? []).forEach((item: any) => {
    counts[item.candidate_id] = item.vote_count
  })
  voteCounts.value = counts
}

const loadMyVote = async () => {
  const roomId = getRoomIdOrThrow()
  const participantId = getParticipantIdOrThrow()

  const { data, error: err } = await supabase
    .from('place_votes')
    .select('candidate_id')
    .eq('room_id', roomId)
    .eq('participant_id', participantId)
    .maybeSingle()

  if (err) throw err
  myVote.value = (data as any)?.candidate_id ?? null
}

// =========================
// Actions
// =========================
const handleAddPlace = async () => {
  if (isPlaceFinalized.value) {
    toast.error('이미 장소가 확정되어 후보를 추가할 수 없습니다')
    return
  }

  if (!form.name.trim()) {
    error.value = '장소 이름을 입력해주세요'
    return
  }

  if (form.url.trim() && !normalizeUrlOrNull(form.url)) {
    error.value = 'URL 형식이 올바르지 않습니다. (https:// 로 시작하는 링크 권장)'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const roomId = getRoomIdOrThrow()
    const participantId = getParticipantIdOrThrow()

    await setTokenContextIfExists()

    const { error: err } = await supabase
      .from('place_candidates')
      .insert({
        room_id: roomId,
        name: form.name.trim(),
        address: (form.address ?? '').trim() || null,
        url: normalizeUrlOrNull(form.url),
        created_by_participant_id: participantId
      })

    if (err) throw err

    form.name = ''
    form.address = ''
    form.url = ''

    await loadCandidates()
    await loadVoteCounts()
    toast.success('장소 후보가 추가되었습니다')
  } catch (err: any) {
    error.value = err?.message || '장소 추가에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(err)
  } finally {
    loading.value = false
  }
}

const handleVote = async (candidateId: string) => {
  if (isPlaceFinalized.value) {
    toast.error('이미 장소가 확정되어 투표할 수 없습니다')
    return
  }

  loading.value = true
  error.value = ''

  try {
    const roomId = getRoomIdOrThrow()
    const participantId = getParticipantIdOrThrow()

    await setTokenContextIfExists()

    const { error: err } = await supabase
      .from('place_votes')
      .upsert(
        {
          room_id: roomId,
          participant_id: participantId,
          candidate_id: candidateId
        },
        { onConflict: 'room_id,participant_id' }
      )

    if (err) throw err

    await loadMyVote()
    await loadVoteCounts()
  } catch (err: any) {
    error.value = err?.message || '투표에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(err)
  } finally {
    loading.value = false
  }
}

const handleFinalize = async (candidateId: string) => {
  if (isPlaceFinalized.value) {
    toast.error('이미 장소가 확정되어 변경할 수 없습니다')
    return
  }

  if (!canFinalize.value) {
    toast.error('방장만 확정할 수 있습니다')
    return
  }

  if (!confirm('이 장소를 확정하시겠습니까?')) return

  loading.value = true
  error.value = ''

  try {
    const roomId = getRoomIdOrThrow()

    // RLS 컨텍스트(토큰) 주입: rooms.update가 정책에서 필요할 수 있음
    await setTokenContextIfExists()

    // ✅ Edge Function 호출 제거
    // ✅ SummaryTab과 동일하게 rooms 테이블 직접 업데이트
    const { error: updErr } = await supabase
      .from('rooms')
      .update({ finalized_place_id: candidateId })
      .eq('id', roomId)

    if (updErr) throw updErr

    await loadCandidates()
    await loadVoteCounts()

    // ✅ props.room은 부모 소유라서 여기서 갱신 불가 → 부모에게 room refresh 요청
    emit('refresh-room')

    toast.success('장소가 확정되었습니다')
  } catch (err: any) {
    error.value = err?.message || '장소 확정에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(err)
  } finally {
    loading.value = false
  }
}

// =========================
// init
// =========================
onMounted(() => {
  Promise.all([loadHost(), loadCandidates(), loadVoteCounts(), loadMyVote()]).catch((e) => {
    if (import.meta.dev) console.error(e)
  })
})
</script>

<style scoped>
.places-tab {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #333;
}
.place-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
}
input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}
.btn-primary {
  padding: 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.empty-state {
  color: #888;
  text-align: center;
  padding: 2rem;
}
.candidates-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.candidate-item {
  padding: 1.25rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 2px solid transparent;
}
.candidate-item.finalized {
  border-color: #28a745;
  background: #f0fff4;
}
.candidate-info h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #333;
}
.address {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
.url {
  margin-bottom: 0.5rem;
}
.url a {
  color: #2563eb;
  font-weight: 600;
  text-decoration: underline;
  font-size: 0.7rem;
}
.vote-count {
  color: #007bff;
  font-weight: 600;
  font-size: 0.9rem;
}
.candidate-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.btn-vote {
  padding: 0.5rem 1rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-vote.active {
  background: #007bff;
}
.btn-finalize {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}
.finalized-badge {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
}
.error-message {
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  font-size: 0.9rem;
}
.help {
  color: #777;
  font-size: 0.85rem;
  line-height: 1.35;
  margin-top: 0.25rem;
}
.hint {
  margin-top: 0.75rem;
  color: #777;
  font-size: 0.85rem;
  line-height: 1.35;
}

.hint-danger {
  color: #dc2626;
  font-weight: 700;
}
</style>
