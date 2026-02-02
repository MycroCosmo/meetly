<!-- SummaryTab.vue (B안 유지 + 확정 정보 "복사" 버튼 + 방장 전용 확정 버튼 + 제출 없이 확정해도 시간 투표 현황에 표시) -->
<template>
  <div class="summary-tab">
    <!-- ===================== -->
    <!-- 1. 확정 정보 -->
    <!-- ===================== -->
    <div class="section">
      <div class="section-head-inline">
        <h2>확정 정보</h2>

        <!-- ✅ 확정 정보 복사 버튼: 시간+장소 둘 다 확정되었을 때만 노출 -->
        <button
          v-if="canCopyFinalized"
          class="btn-copy-finalized"
          type="button"
          :disabled="copying"
          @click="handleCopyFinalized"
        >
          {{ copied ? '복사됨!' : '확정 정보 복사' }}
        </button>
      </div>

      <div v-if="loadingFinalized" class="section-loading">
        <div class="spinner" aria-label="loading" />
        <p class="loading-text">확정 정보를 불러오는 중...</p>
      </div>

      <template v-else>
        <div
          v-if="!room.finalized_time_start && !room.finalized_place_id"
          class="empty-state"
        >
          아직 시간과 장소가 확정되지 않았습니다.
        </div>

        <div v-else class="finalized-info">
          <div v-if="room.finalized_time_start" class="info-block">
            <h3>시간</h3>
            <p class="time-text">{{ timeText }}</p>
          </div>

          <div v-if="finalizedPlace" class="info-block">
            <h3>장소</h3>
            <p class="place-name">{{ finalizedPlace.name }}</p>

            <p v-if="finalizedPlace.address" class="place-address">
              {{ finalizedPlace.address }}
            </p>

            <!-- ✅ 확정 장소 URL: 클릭 시 새창 -->
            <p v-if="finalizedPlace.url" class="place-url">
              <a :href="finalizedPlace.url" target="_blank" rel="noopener noreferrer">
                링크 열기
              </a>
              <span class="url-raw">{{ finalizedPlace.url }}</span>
            </p>
          </div>
        </div>
      </template>

      <p v-if="isHost" class="host-hint">방장 권한으로 시간/장소를 확정할 수 있습니다.</p>
    </div>

    <!-- ===================== -->
    <!-- 2. 시간 투표 현황 -->
    <!-- ===================== -->
    <div class="section">
      <div class="section-head">
        <h2>시간 투표 현황</h2>

        <div class="toolbar" v-if="!loadingTimeVotes && groupedDates.length >= 1">
          <span class="muted">날짜 클릭하면 상세가 펼쳐집니다</span>
        </div>
      </div>

      <div v-if="loadingTimeVotes" class="section-loading">
        <div class="spinner" aria-label="loading" />
        <p class="loading-text">시간 투표를 집계하는 중...</p>
      </div>

      <template v-else>
        <div v-if="isTimeEmpty" class="empty-state">투표된 시간이 없습니다.</div>

        <div v-else class="date-list">
          <button
            v-for="g in groupedDates"
            :key="g.dateIso"
            class="date-card"
            type="button"
            @click="toggleOpen(g.dateIso)"
            :aria-expanded="openDate === g.dateIso"
          >
            <div class="date-card-head">
              <div class="date-title">
                <span class="date-iso">{{ g.dateIso }}</span>
                <span class="date-weekday">({{ g.weekday }})</span>
              </div>

              <div class="date-meta">
                <span class="pill">{{ g.maxCount }}명 투표</span>
                <span class="pill">{{ g.items.length }}개</span>

                <!-- ✅ 제출이 0명이어도 확정된 날짜면 뱃지 표시 -->
                <span v-if="finalizedDateIso === g.dateIso" class="pill pill-finalized">확정</span>

                <span class="chev" :class="{ open: openDate === g.dateIso }">⌄</span>
              </div>
            </div>

            <div v-if="openDate === g.dateIso" class="date-card-body" @click.stop>
              <!-- ✅ 제출이 없어도 확정된 시간은 항상 보여주기 -->
              <div v-if="finalizedDateIso === g.dateIso && room.finalized_time_start" class="vote-row">
                <div class="vote-time">
                  <div class="t-main">
                    {{ finalizedAllDay ? '상관없음' : '확정 시간' }}
                  </div>
                  <div v-if="!finalizedAllDay" class="t-sub">{{ timeText }}</div>
                </div>

                <div class="vote-right">
                  <span class="finalized-badge-mini">확정</span>
                </div>
              </div>

              <div class="vote-row" v-if="g.allDayCount >= 1">
                <div class="vote-time">
                  <div class="t-main">상관없음</div>
                </div>

                <div class="vote-right">
                  <div class="vote-count allday-count">{{ g.allDayCount }}명</div>

                  <button
                    v-if="isHost && !room.finalized_time_start"
                    class="btn-finalize-time"
                    type="button"
                    :disabled="finalizing"
                    @click="finalizeAllDayByDate(g.dateIso)"
                  >
                    날짜 확정
                  </button>
                </div>
              </div>

              <div class="vote-row" v-for="v in g.items" :key="v.slot_start">
                <div class="vote-time">
                  <span class="t-main">{{ formatDateTime(v.slot_start) }}</span>
                </div>

                <div class="vote-right">
                  <div class="vote-count" :class="{ best: v.participant_count === g.maxCount }">
                    {{ v.participant_count }}명
                  </div>

                  <button
                    v-if="isHost && !room.finalized_time_start"
                    class="btn-finalize-time"
                    type="button"
                    :disabled="finalizing"
                    @click="finalizeTimeBySlotStart(v.slot_start)"
                  >
                    이 시간 확정
                  </button>
                </div>
              </div>

              <p v-if="isHost" class="hint-mini">- 확정 시 “확정 정보” 섹션이 즉시 반영됩니다.</p>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- ===================== -->
    <!-- 3. 장소 투표 현황 -->
    <!-- ===================== -->
    <div class="section">
      <h2>장소 투표 현황</h2>

      <div v-if="loadingPlaceVotes" class="section-loading">
        <div class="spinner" aria-label="loading" />
        <p class="loading-text">장소 투표를 불러오는 중...</p>
      </div>

      <template v-else>
        <div v-if="placeVotes.length === 0" class="empty-state">투표된 장소가 없습니다.</div>

        <div v-else class="votes-list">
          <div v-for="vote in placeVotes" :key="vote.id" class="vote-item">
            <div class="place-left">
              <p class="vote-place">{{ vote.name }}</p>
              <p v-if="vote.address" class="place-sub">{{ vote.address }}</p>
              <p v-if="vote.url" class="place-sub">
                <a :href="vote.url" target="_blank" rel="noopener noreferrer">링크로 이동</a>
              </p>
            </div>

            <div class="place-right">
              <p class="vote-count">{{ vote.vote_count }}표</p>

              <button
                v-if="isHost && !room.finalized_place_id"
                class="btn-finalize-place"
                type="button"
                :disabled="finalizing"
                @click="finalizePlaceFromSummary(vote.id)"
              >
                이 장소 확정
              </button>
              <span v-else-if="room.finalized_place_id === vote.id" class="finalized-badge">확정</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Room, Participant } from '~/composables/useRoom'
import type { TimeVote, PlaceVote } from '~/types'
import { useDateFormat } from '~/composables/useDateFormat'

type FinalizedPlace = {
  id: string
  name: string
  address: string | null
  url: string | null
}

type DateGroup = {
  dateIso: string
  weekday: string
  maxCount: number
  items: TimeVote[]
  allDayCount: number
}

const props = defineProps<{ room: Room; participant: Participant }>()
const supabase = useSupabase()
const { formatDateTime, formatTime } = useDateFormat()

/** ===== 방장 판별 ===== */
const hostParticipantId = ref<string | null>(null)
const isHost = computed(() => hostParticipantId.value === props.participant?.id)

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

/** ===== 상태 ===== */
const finalizedPlace = ref<FinalizedPlace | null>(null)

const copied = ref(false)
const copying = ref(false)

const errorMessage = ref('')

const timeVotes = ref<TimeVote[]>([])
const placeVotes = ref<PlaceVote[]>([])

const loadingFinalized = ref(false)
const loadingTimeVotes = ref(false)
const loadingPlaceVotes = ref(false)

const openDate = ref<string | null>(null)
const finalizing = ref(false)

/** 요일 */
const weekdayKo = ['일', '월', '화', '수', '목', '금', '토']

/** KST 기준 YYYY-MM-DD */
const toLocalDateIso = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getWeekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0)
  return weekdayKo[dt.getDay()]
}

/** 확정 시간 표시 */
const timeText = computed(() => {
  const s = props.room.finalized_time_start
  const e = props.room.finalized_time_end
  if (!s) return ''
  if (!e) return formatDateTime(s)
  return `${formatDateTime(s)} - ${formatTime(e)}`
})

/** ✅ 확정 정보 복사 가능 조건 */
const canCopyFinalized = computed(() => {
  return !!props.room.finalized_time_start && !!finalizedPlace.value
})

/** ✅ 복사용 확정 정보 텍스트(형식 고정) */
const finalizedCopyText = computed(() => {
  if (!canCopyFinalized.value) return ''

  const placeName = finalizedPlace.value!.name
  const placeAddress = finalizedPlace.value!.address ? `\n주소: ${finalizedPlace.value!.address}` : ''
  const placeUrl = finalizedPlace.value!.url ? `\n링크: ${finalizedPlace.value!.url}` : ''

  return `모임 확정 정보
제목: ${props.room.title}
시간: ${timeText.value}
장소: ${placeName}${placeAddress}${placeUrl}`
})

/**
 * ✅ 확정된 날짜 ISO / 올데이 여부
 * - 제출이 0명이어도 "시간 투표 현황"에 날짜가 뜨게 하는 핵심
 */
const finalizedDateIso = computed(() => {
  const s = props.room.finalized_time_start
  if (!s) return null
  return toLocalDateIso(new Date(s))
})

const finalizedAllDay = computed(() => {
  const s = props.room.finalized_time_start
  const e = props.room.finalized_time_end
  if (!s || !e) return false
  const ds = new Date(s)
  const de = new Date(e)
  const durationMin = (de.getTime() - ds.getTime()) / 60000
  return durationMin >= 24 * 60 - 1
})

/**
 * 날짜별 "상관없음(올데이)" 인원수
 */
type AvailabilityBlockLite = {
  participant_id: string
  start_at: string
  end_at: string
}
const allDayCountByDate = ref<Record<string, number>>({})

const loadAllDayCountsByDate = async () => {
  allDayCountByDate.value = {}

  const { data, error } = await supabase
    .from('availability_blocks')
    .select('participant_id, start_at, end_at')
    .eq('room_id', props.room.id)

  if (error) {
    if (import.meta.dev) console.error(error)
    return
  }

  const map: Record<string, Set<string>> = {}

  for (const b of (data ?? []) as AvailabilityBlockLite[]) {
    const bs = new Date(b.start_at)
    const be = new Date(b.end_at)
    const durationMin = (be.getTime() - bs.getTime()) / 60000

    if (durationMin < 24 * 60 - 1) continue

    const dateIso = toLocalDateIso(bs)
    if (!map[dateIso]) map[dateIso] = new Set<string>()
    map[dateIso].add(b.participant_id)
  }

  const out: Record<string, number> = {}
  for (const k of Object.keys(map)) out[k] = map[k].size
  allDayCountByDate.value = out
}

/** 날짜 그룹 */
const groupedDates = computed<DateGroup[]>(() => {
  const map = new Map<string, TimeVote[]>()

  for (const v of timeVotes.value) {
    const dt = new Date(v.slot_start)
    const iso = toLocalDateIso(dt)
    if (!map.has(iso)) map.set(iso, [])
    map.get(iso)!.push(v)
  }

  // ✅ 올데이 투표가 있는 날짜도 포함
  for (const iso of Object.keys(allDayCountByDate.value)) {
    if (!map.has(iso)) map.set(iso, [])
  }

  // ✅ 확정된 날짜가 "제출/투표 0개"여도 리스트에 뜨도록 강제 포함
  if (finalizedDateIso.value && !map.has(finalizedDateIso.value)) {
    map.set(finalizedDateIso.value, [])
  }

  const groups: DateGroup[] = []
  for (const [dateIso, items] of map.entries()) {
    const sorted = [...items].sort((a, b) => Date.parse(a.slot_start) - Date.parse(b.slot_start))
    const maxSlot = sorted.reduce((mx, x) => Math.max(mx, x.participant_count), 0)

    const allDay = allDayCountByDate.value[dateIso] ?? 0
    const maxCount = Math.max(maxSlot, allDay)

    groups.push({
      dateIso,
      weekday: getWeekday(dateIso),
      maxCount,
      items: sorted,
      allDayCount: allDay
    })
  }

  groups.sort((a, b) => (a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0))
  return groups
})

const isTimeEmpty = computed(() => {
  const hasVotes = timeVotes.value.length > 0
  const hasAllDay = Object.keys(allDayCountByDate.value).length > 0
  const hasFinalizedSeed = !!finalizedDateIso.value
  return !hasVotes && !hasAllDay && !hasFinalizedSeed
})

const toggleOpen = (dateIso: string) => {
  openDate.value = openDate.value === dateIso ? null : dateIso
}

/* =====================
 * 데이터 로딩
 * ===================== */
const loadFinalizedPlace = async () => {
  loadingFinalized.value = true
  try {
    finalizedPlace.value = null
    if (!props.room.finalized_place_id) return

    const { data, error } = await supabase
      .from('place_candidates')
      .select('id, name, address, url')
      .eq('id', props.room.finalized_place_id)
      .maybeSingle()

    if (error) return
    finalizedPlace.value = data
  } finally {
    loadingFinalized.value = false
  }
}

const loadTimeVotes = async () => {
  loadingTimeVotes.value = true
  try {
    timeVotes.value = []
    openDate.value = null

    const { data, error } = await supabase.functions.invoke('availability-overlap', {
      body: { room_id: props.room.id, slot_minutes: 30 }
    })

    if (!error && data) {
      timeVotes.value = data.data ?? []
    }

    await loadAllDayCountsByDate()

    await nextTick()
    const first = groupedDates.value[0]?.dateIso
    if (first) openDate.value = first
  } finally {
    loadingTimeVotes.value = false
  }
}

const loadPlaceVotes = async () => {
  loadingPlaceVotes.value = true
  await nextTick()

  try {
    placeVotes.value = []

    const { data: candidates, error: candidateErr } = await supabase
      .from('place_candidates')
      .select('id, name, address, url')
      .eq('room_id', props.room.id)
      .order('created_at', { ascending: true })

    if (candidateErr || !candidates) return

    const { data: voteCounts, error: voteErr } = await supabase.rpc('get_place_vote_counts', {
      p_room_id: props.room.id
    })
    if (voteErr) return

    const voteMap = new Map<string, number>()
    ;(voteCounts ?? []).forEach((v: any) => {
      voteMap.set(v.candidate_id, v.vote_count)
    })

    placeVotes.value = candidates.map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      address: (c.address ?? null) as string | null,
      url: (c.url ?? null) as string | null,
      vote_count: voteMap.get(c.id) ?? 0
    }))
  } finally {
    loadingPlaceVotes.value = false
  }
}

/* =====================
 * 방장 확정 로직
 * ===================== */
const SLOT_MIN = 30

const toUtcIsoFromLocal = (isoDate: string, hh: number, mm: number) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const local = new Date(y, m - 1, d, hh, mm, 0, 0)
  return local.toISOString()
}

const finalizeTimeBySlotStart = async (slotStartIso: string) => {
  if (!isHost.value) return
  if (!confirm('이 시간을 확정하시겠습니까?')) return

  finalizing.value = true
  errorMessage.value = ''

  try {
    const start = new Date(slotStartIso)
    const end = new Date(start.getTime() + SLOT_MIN * 60 * 1000)

    const { error } = await supabase
      .from('rooms')
      .update({
        finalized_time_start: start.toISOString(),
        finalized_time_end: end.toISOString()
      })
      .eq('id', props.room.id)

    if (error) throw error

    await loadFinalizedPlace()
    await loadTimeVotes()
  } catch (e: any) {
    errorMessage.value = e?.message || '시간 확정에 실패했습니다.'
    if (import.meta.dev) console.error(e)
  } finally {
    finalizing.value = false
  }
}

const finalizeAllDayByDate = async (dateIso: string) => {
  if (!isHost.value) return
  if (!confirm('이 날짜를 "하루종일 가능"으로 확정하시겠습니까?')) return

  finalizing.value = true
  errorMessage.value = ''

  try {
    const start = toUtcIsoFromLocal(dateIso, 0, 0)
    const end = toUtcIsoFromLocal(dateIso, 24, 0)

    const { error } = await supabase
      .from('rooms')
      .update({
        finalized_time_start: start,
        finalized_time_end: end
      })
      .eq('id', props.room.id)

    if (error) throw error

    await loadFinalizedPlace()
    await loadTimeVotes()
  } catch (e: any) {
    errorMessage.value = e?.message || '시간 확정에 실패했습니다.'
    if (import.meta.dev) console.error(e)
  } finally {
    finalizing.value = false
  }
}

const finalizePlaceFromSummary = async (candidateId: string) => {
  if (!isHost.value) return
  if (!confirm('이 장소를 확정하시겠습니까?')) return

  finalizing.value = true
  errorMessage.value = ''

  try {
    const { error } = await supabase.from('rooms').update({ finalized_place_id: candidateId }).eq('id', props.room.id)
    if (error) throw error

    await loadFinalizedPlace()
    await loadPlaceVotes()
  } catch (e: any) {
    errorMessage.value = e?.message || '장소 확정에 실패했습니다.'
    if (import.meta.dev) console.error(e)
  } finally {
    finalizing.value = false
  }
}

/* =====================
 * ✅ 확정 정보 복사
 * ===================== */
const handleCopyFinalized = async () => {
  const v = finalizedCopyText.value?.trim()
  if (!v) return

  copying.value = true
  errorMessage.value = ''

  try {
    await navigator.clipboard.writeText(v)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    errorMessage.value = '복사에 실패했습니다.'
  } finally {
    copying.value = false
  }
}

onMounted(async () => {
  await loadHost()
  await loadFinalizedPlace()
  loadTimeVotes()
  loadPlaceVotes()
})

/**
 * ✅ room 값이 새로 갱신되면 Summary도 같이 최신화
 * - "제출 없이 확정" 같은 케이스에서 finalized_time_* 변경을 확실히 반영
 */
watch(
  () => [
    props.room.id,
    props.room.finalized_time_start,
    props.room.finalized_time_end,
    props.room.finalized_place_id
  ],
  async () => {
    await loadFinalizedPlace()
    await loadTimeVotes()
  }
)

watch(
  () => props.room.finalized_place_id,
  () => loadFinalizedPlace()
)
</script>

<style scoped>
.summary-tab {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.section {
  background: #fff;
  padding: 1.5rem;
  border-radius: 12px;
}

/* ✅ 확정 정보 헤더 + 복사 버튼 */
.section-head-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.btn-copy-finalized {
  padding: 0.45rem 0.7rem;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #111827;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-copy-finalized:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  margin-bottom: 10px;
}

.host-hint {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.toolbar .muted {
  font-size: 0.85rem;
  color: #6b7280;
}
.empty-state {
  color: #888;
  text-align: center;
  padding: 1.5rem;
}

.section-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.25rem 0.5rem;
  color: #6b7280;
}
.loading-text {
  margin: 0;
  font-size: 0.9rem;
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid #e5e7eb;
  border-top-color: #111827;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.finalized-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.info-block h3 {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
  color: #111827;
}
.time-text,
.place-name,
.place-address,
.place-url {
  margin: 0;
}

.place-url {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.place-url a {
  color: #2563eb;
  text-decoration: underline;
  font-weight: 800;
}
.url-raw {
  color: #6b7280;
  font-size: 0.8rem;
  word-break: break-all;
}

/* 날짜 카드 */
.date-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.date-card {
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  border-radius: 12px;
  padding: 0.9rem 1rem;
  cursor: pointer;
  text-align: left;
}
.date-card:hover {
  background: #f7f7f7;
}
.date-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.date-title {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-weight: 700;
  color: #111827;
}
.date-iso {
  font-size: 1rem;
}
.date-weekday {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 600;
}

.date-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.pill {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 0.8rem;
  color: #111827;
  font-weight: 700;
}
.pill-finalized {
  background: #dcfce7;
  color: #166534;
}

.finalized-badge-mini {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #16a34a;
  color: #fff;
  font-weight: 900;
  font-size: 0.75rem;
}

.chev {
  display: inline-block;
  font-weight: 900;
  color: #6b7280;
  transform: rotate(0deg);
  transition: transform 0.15s ease;
}
.chev.open {
  transform: rotate(180deg);
}

.date-card-body {
  margin-top: 0.75rem;
  background: #fff;
  border-radius: 10px;
  padding: 0.75rem;
  border: 1px solid #eee;
}
.vote-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}
.vote-row:last-child {
  border-bottom: none;
}
.vote-time {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
}
.t-main {
  font-weight: 700;
  color: #111827;
}
.t-sub {
  font-size: 0.85rem;
  color: #6b7280;
}

.vote-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.vote-count {
  font-weight: 800;
  color: #111827;
}
.vote-count.best {
  color: #2563eb;
}
.allday-count {
  color: #111827;
}

.btn-finalize-time {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: none;
  background: #111827;
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-finalize-time:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint-mini {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  color: #6b7280;
}

/* 장소 투표 */
.votes-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.vote-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}
.vote-item:last-child {
  border-bottom: none;
}
.vote-place {
  margin: 0;
  font-weight: 700;
  color: #111827;
}
.place-sub {
  margin: 0.2rem 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.place-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.btn-finalize-place {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: none;
  background: #16a34a;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-finalize-place:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.finalized-badge {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  background: #16a34a;
  color: #fff;
  font-weight: 900;
  font-size: 0.8rem;
}

.error-message {
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
