<template>
  <div class="time-tab">
    <!-- 범위 선택 -->
    <div class="section">
      <h2>가능한 시간 선택</h2>

      <div class="range-row">
        <div class="range-field">
          <label>시작</label>
          <input
            v-model="draftRange.start"
            type="date"
            :disabled="!canFinalize || loading || isFinalized"
            @change="markRangeDirty"
          />
        </div>

        <div class="range-field">
          <label>끝</label>
          <input
            v-model="draftRange.end"
            type="date"
            :disabled="!canFinalize || loading || isFinalized"
            @change="markRangeDirty"
          />
        </div>

        <button
          class="btn-primary"
          :disabled="loading || !canFinalize || isFinalized || !rangeDirty"
          @click="applyRange"
          type="button"
        >
          범위 적용
        </button>
      </div>

      <p class="hint">
        - 날짜 범위 설정은 방장만 가능합니다.<br />
        - 시간이 확정되면 날짜 범위도 수정할 수 없습니다.<br />
        - 날짜 변경은 “범위 적용”을 눌러야 반영됩니다.<br />
      </p>
    </div>

    <!-- 날짜 선택 -->
    <div class="section">
      <h2>날짜 선택</h2>

      <div v-if="loading" class="empty-state">로딩 중...</div>

      <div v-else class="calendar-grid">
        <button
          v-for="d in days"
          :key="d.iso"
          class="day-cell"
          :class="{ active: selectedDate === d.iso, disabled: isFinalized }"
          :disabled="loading"
          @click="selectDate(d.iso)"
          type="button"
        >
          <div class="day-label">
            <span class="md">{{ d.month }}/{{ d.day }}</span>
            <span class="wd">{{ d.weekday }}</span>
          </div>

          <div v-if="(dateCounts[d.iso] ?? 0) >= 1" class="badge">
            {{ dateCounts[d.iso] }}명
          </div>
        </button>
      </div>

      <p v-if="isFinalized" class="hint hint-danger">
        - 시간이 이미 확정되어 더 이상 제출/수정은 불가능합니다. (조회만 가능)
      </p>
    </div>

    <!-- 선택된 날짜의 시간 선택 + 제출 + (방장) 확정 -->
    <div class="section" v-if="selectedDate">
      <h2>시간 선택 - {{ formatKoreanDate(selectedDate) }}</h2>

      <!-- 시간상관없음 옵션 -->
      <div class="all-day-row">
        <label class="all-day">
          <input type="checkbox" v-model="allDay" :disabled="isFinalized || loading" />
          시간상관없음
        </label>
      </div>

      <div class="heatmap">
        <button
          v-for="slot in daySlots"
          :key="slot.key"
          class="slot"
          :class="{
            picked: selectedKeys.has(slot.key),
            disabled: allDay || isFinalized
          }"
          :data-level="slot.level"
          :disabled="allDay || isFinalized"
          @click="toggleSlot(slot)"
          type="button"
        >
          <div class="slot-time">{{ slot.label }}</div>
          <div class="slot-count">{{ slot.count }}명</div>
        </button>
      </div>

      <div class="actions">
        <button
          class="btn-primary"
          :disabled="loading || isFinalized"
          @click="submitMyAvailability"
          type="button"
        >
          내 가능 시간 제출
        </button>

        <button
          v-if="canFinalize && !isFinalized"
          class="btn-finalize"
          :disabled="loading || !canFinalizeTime"
          @click="finalizeTime"
          type="button"
        >
          이 시간으로 확정
        </button>

        <button
          class="btn-ghost"
          :disabled="loading || isFinalized"
          @click="clearMySelectionForDay(true)"
          type="button"
        >
          선택 초기화
        </button>
      </div>

      <div v-if="finalizedText" class="finalized-box">
        <div class="finalized-title">현재 확정된 시간</div>
        <div class="finalized-value">{{ finalizedText }}</div>
      </div>

      <p class="hint">
        - 참가자는 가능한 시간을 제출합니다.<br />
        - 방장은 원하는 날짜/시간을 선택한 뒤 “이 시간으로 확정”을 누르면 확정됩니다.<br />
        - 상관없음 선택 시, 해당 날짜 00:00~24:00로 확정됩니다.<br />
        - 확정 이후에는 제출/수정/초기화가 불가능합니다.
      </p>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Room, Participant } from '~/composables/useRoom'
import { useRlsContext } from '~/composables/useRlsContext'
import { useDateFormat } from '~/composables/useDateFormat'
import { useToast } from '~/composables/useToast'

const props = defineProps<{ room: Room; participant: Participant }>()
const emit = defineEmits<{ 'refresh-room': [] }>()

const supabase = useSupabase()
const { setRlsContextIfPossible } = useRlsContext()
const { formatKoreanDate } = useDateFormat()
const toast = useToast()

/**
 * ✅ 확정 여부: finalized_time_start가 있으면 잠금
 */
const isFinalized = computed(() => !!(props.room as any).finalized_time_start)

/**
 * ✅ 방장 판별
 */
const hostParticipantId = ref<string | null>(null)
const canFinalize = computed(() => hostParticipantId.value === props.participant.id)

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

type AvailabilityBlock = {
  id: string
  room_id: string
  participant_id: string
  start_at: string
  end_at: string
}

const loading = ref(false)
const error = ref('')

/**
 * ✅ 로컬(한국) 기준 날짜 유틸
 */
const localDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

const isoFromLocalDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayIsoLocal = () => isoFromLocalDate(new Date())

const addDaysIsoLocal = (baseIso: string, add: number) => {
  const d = localDate(baseIso)
  d.setDate(d.getDate() + add)
  return isoFromLocalDate(d)
}

/**
 * 로컬 yyyy-mm-dd + 시/분 -> UTC ISO
 */
const toUtcIsoFromLocal = (isoDate: string, hh: number, mm: number) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const local = new Date(y, m - 1, d, hh, mm, 0, 0)
  return local.toISOString()
}

/**
 * ✅ draftRange: 입력값
 * ✅ appliedRange: 실제 적용값(달력/조회/집계 기준)
 */
const draftRange = reactive({
  start: todayIsoLocal(),
  end: addDaysIsoLocal(todayIsoLocal(), 14)
})

const appliedRange = reactive({
  start: todayIsoLocal(),
  end: addDaysIsoLocal(todayIsoLocal(), 14)
})

const rangeDirty = ref(false)
const markRangeDirty = () => {
  rangeDirty.value = true
}

/**
 * ✅ 방(room)에 저장된 범위가 변경되면 appliedRange를 갱신
 * - draft는 사용자가 편집중일 수 있으니, dirty 아닐 때만 같이 맞춤
 */
watchEffect(() => {
  const rs = (props.room as any).date_start as string | undefined
  const re = (props.room as any).date_end as string | undefined

  if (rs) appliedRange.start = rs
  if (re) appliedRange.end = re

  if (!rangeDirty.value) {
    if (rs) draftRange.start = rs
    if (re) draftRange.end = re
  }
})

/**
 * ✅ 달력은 appliedRange 기준으로만 생성 (중요)
 */
const days = computed(() => {
  const out: Array<{ iso: string; month: number; day: number; weekday: string }> = []
  const start = localDate(appliedRange.start)
  const end = localDate(appliedRange.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out
  if (end < start) return out

  const weekdayKo = ['일', '월', '화', '수', '목', '금', '토']
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoFromLocalDate(d)
    out.push({
      iso,
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: weekdayKo[d.getDay()]
    })
  }
  return out
})

const selectedDate = ref<string>('')

/**
 * ✅ 상관없음
 */
const allDay = ref(false)

watch(selectedDate, () => {
  allDay.value = false
  clearMySelectionForDay(false)
})

const dateCounts = ref<Record<string, number>>({})

type Slot = {
  key: string
  label: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  start: Date
  end: Date
}

const daySlots = ref<Slot[]>([])
const SLOT_MIN = 30

const toLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

/**
 * ✅ 조회도 appliedRange 기준으로만 (중요)
 */
const fetchBlocksInRange = async (): Promise<AvailabilityBlock[]> => {
  await setRlsContextIfPossible()

  const startAt = toUtcIsoFromLocal(appliedRange.start, 0, 0)
  const endAt = toUtcIsoFromLocal(addDaysIsoLocal(appliedRange.end, 1), 0, 0)

  const { data, error: err } = await supabase
    .from('availability_blocks')
    .select('id, room_id, participant_id, start_at, end_at')
    .eq('room_id', props.room.id)
    .gte('end_at', startAt)
    .lte('start_at', endAt)

  if (err) throw err
  return (data ?? []) as AvailabilityBlock[]
}

const buildDaySlots = (isoDate: string, blocks: AvailabilityBlock[]) => {
  const start = localDate(isoDate)

  const slots: Slot[] = []
  const slotCount = Math.floor((24 * 60) / SLOT_MIN)

  for (let i = 0; i < slotCount; i++) {
    const s = new Date(start)
    s.setMinutes(s.getMinutes() + i * SLOT_MIN)
    const e = new Date(s)
    e.setMinutes(e.getMinutes() + SLOT_MIN)

    const set = new Set<string>()
    for (const b of blocks) {
      const bs = new Date(b.start_at)
      const be = new Date(b.end_at)
      if (bs < e && be > s) set.add(b.participant_id)
    }

    const c = set.size
    slots.push({
      key: `${isoDate}|${i}`,
      label: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
      count: c,
      level: toLevel(c),
      start: s,
      end: e
    })
  }

  daySlots.value = slots
}

const buildDateCounts = (blocks: AvailabilityBlock[]) => {
  const map: Record<string, number> = {}

  for (const d of days.value) {
    const iso = d.iso
    const dayStart = localDate(iso)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayBlocks = blocks.filter(b => {
      const bs = new Date(b.start_at)
      const be = new Date(b.end_at)
      return bs < dayEnd && be > dayStart
    })

    if (dayBlocks.length === 0) {
      map[iso] = 0
      continue
    }

    const slotCount = Math.floor((24 * 60) / SLOT_MIN)
    let max = 0

    for (let i = 0; i < slotCount; i++) {
      const s = new Date(dayStart)
      s.setMinutes(s.getMinutes() + i * SLOT_MIN)
      const e = new Date(s)
      e.setMinutes(e.getMinutes() + SLOT_MIN)

      const set = new Set<string>()
      for (const b of dayBlocks) {
        const bs = new Date(b.start_at)
        const be = new Date(b.end_at)
        if (bs < e && be > s) set.add(b.participant_id)
      }
      if (set.size > max) max = set.size
    }

    map[iso] = max
  }

  dateCounts.value = map
}

/**
 * ✅ "범위 적용" 눌렀을 때만 반영
 */
const applyRange = async () => {
  loading.value = true
  error.value = ''
  try {
    if (isFinalized.value) {
      toast.error('이미 시간이 확정되어 날짜 범위를 수정할 수 없습니다')
      return
    }
    if (!canFinalize.value) throw new Error('방장만 날짜 범위를 설정할 수 있습니다.')

    if (localDate(draftRange.end) < localDate(draftRange.start)) {
      throw new Error('끝 날짜는 시작 날짜 이후여야 합니다.')
    }

    await setRlsContextIfPossible()

    const { error: err } = await supabase
      .from('rooms')
      .update({ date_start: draftRange.start, date_end: draftRange.end })
      .eq('id', props.room.id)

    if (err) throw err

    // ✅ UI 반영은 여기서 appliedRange 업데이트
    appliedRange.start = draftRange.start
    appliedRange.end = draftRange.end
    rangeDirty.value = false

    // ✅ 적용된 범위 기준으로만 reload
    await reloadAll()
    toast.success('날짜 범위가 적용되었습니다')
  } catch (e: any) {
    error.value = e?.message || '범위 적용에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
  }
}

const reloadAll = async () => {
  loading.value = true
  error.value = ''
  try {
    const blocks = await fetchBlocksInRange()
    buildDateCounts(blocks)

    if (selectedDate.value) {
      const exists = days.value.some(d => d.iso === selectedDate.value)
      if (!exists) selectedDate.value = ''
    }

    if (selectedDate.value) {
      const iso = selectedDate.value
      const dayStart = localDate(iso)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const dayBlocks = blocks.filter(
        b => new Date(b.start_at) < dayEnd && new Date(b.end_at) > dayStart
      )
      buildDaySlots(iso, dayBlocks)
    } else {
      daySlots.value = []
    }
  } catch (e: any) {
    error.value = e?.message || '시간 정보를 불러오지 못했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
  }
}

const selectDate = async (iso: string) => {
  selectedDate.value = iso
  await reloadAll()
}

const selectedKeys = ref<Set<string>>(new Set())

watch(allDay, (v) => {
  if (v) clearMySelectionForDay(false)
})

const toggleSlot = (slot: Slot) => {
  if (isFinalized.value) return
  if (allDay.value) return

  const s = new Set(selectedKeys.value)
  if (s.has(slot.key)) s.delete(slot.key)
  else s.add(slot.key)
  selectedKeys.value = s
}

const clearMySelectionForDay = (showToast: boolean) => {
  if (isFinalized.value) {
    if (showToast) toast.error('이미 시간이 확정되어 수정할 수 없습니다')
    return
  }
  if (!selectedDate.value) return

  const iso = selectedDate.value

  const next = new Set<string>()
  for (const k of selectedKeys.value) {
    if (!k.startsWith(iso + '|')) next.add(k)
  }

  const beforeSize = selectedKeys.value.size
  selectedKeys.value = next

  if (showToast && beforeSize !== next.size) {
    toast.info('선택이 초기화되었습니다')
  }
}

const submitMyAvailability = async () => {
  if (!selectedDate.value) return

  if (isFinalized.value) {
    toast.error('이미 시간이 확정되어 더 이상 제출할 수 없습니다')
    return
  }

  loading.value = true
  error.value = ''
  try {
    await setRlsContextIfPossible()

    const iso = selectedDate.value

    let pickedIdx: number[] = []
    if (!allDay.value) {
      pickedIdx = Array.from(selectedKeys.value)
        .filter(k => k.startsWith(iso + '|'))
        .map(k => Number(k.split('|')[1]))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b)
    }

    const dayStartIso = toUtcIsoFromLocal(iso, 0, 0)
    const dayEndIso = toUtcIsoFromLocal(iso, 24, 0)

    // 1) 기존 내 블록 삭제
    {
      const { error: delErr } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('room_id', props.room.id)
        .eq('participant_id', props.participant.id)
        .gte('start_at', dayStartIso)
        .lte('end_at', dayEndIso)

      if (delErr) throw delErr
    }

    if (!allDay.value && pickedIdx.length === 0) {
      await reloadAll()
      toast.info('가능 시간이 초기화되었습니다')
      return
    }

    const blocksToInsert: Array<
      Pick<AvailabilityBlock, 'room_id' | 'participant_id' | 'start_at' | 'end_at'>
    > = []

    if (allDay.value) {
      blocksToInsert.push({
        room_id: props.room.id,
        participant_id: props.participant.id,
        start_at: toUtcIsoFromLocal(iso, 0, 0),
        end_at: toUtcIsoFromLocal(iso, 24, 0)
      })
    } else {
      const slotToTime = (idx: number) => {
        const totalMin = idx * 30
        const hh = Math.floor(totalMin / 60)
        const mm = totalMin % 60
        return { hh, mm }
      }

      let runStart = pickedIdx[0]
      let prev = pickedIdx[0]

      const flush = (startIdx: number, endExclusiveIdx: number) => {
        const s = slotToTime(startIdx)
        const e = slotToTime(endExclusiveIdx)
        blocksToInsert.push({
          room_id: props.room.id,
          participant_id: props.participant.id,
          start_at: toUtcIsoFromLocal(iso, s.hh, s.mm),
          end_at: toUtcIsoFromLocal(iso, e.hh, e.mm)
        })
      }

      for (let i = 1; i < pickedIdx.length; i++) {
        const cur = pickedIdx[i]
        if (cur === prev + 1) prev = cur
        else {
          flush(runStart, prev + 1)
          runStart = cur
          prev = cur
        }
      }
      flush(runStart, prev + 1)
    }

    const { error: insErr } = await supabase.from('availability_blocks').insert(blocksToInsert)
    if (insErr) throw insErr

    await reloadAll()
    toast.success(allDay.value ? '시간 상관없음으로 제출되었습니다' : '가능 시간이 제출되었습니다')
  } catch (e: any) {
    error.value = e?.message || '제출에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
  }
}

/**
 * ✅ 방장 확정 로직
 */
const canFinalizeTime = computed(() => {
  if (!selectedDate.value) return false
  if (!canFinalize.value) return false
  if (isFinalized.value) return false
  if (allDay.value) return true
  const iso = selectedDate.value
  return Array.from(selectedKeys.value).some(k => k.startsWith(iso + '|'))
})

const finalizeTime = async () => {
  if (!canFinalize.value) {
    toast.error('방장만 확정할 수 있습니다')
    return
  }
  if (isFinalized.value) {
    toast.error('이미 확정되어 변경할 수 없습니다')
    return
  }
  if (!selectedDate.value) return
  if (!canFinalizeTime.value) {
    toast.error('확정할 시간을 선택하세요')
    return
  }

  if (!confirm('이 날짜/시간으로 확정하시겠습니까?')) return

  loading.value = true
  error.value = ''
  try {
    await setRlsContextIfPossible()

    const iso = selectedDate.value

    let startIso: string
    let endIso: string

    if (allDay.value) {
      startIso = toUtcIsoFromLocal(iso, 0, 0)
      endIso = toUtcIsoFromLocal(iso, 24, 0)
    } else {
      const pickedIdx = Array.from(selectedKeys.value)
        .filter(k => k.startsWith(iso + '|'))
        .map(k => Number(k.split('|')[1]))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b)

      const minIdx = pickedIdx[0]
      const maxIdx = pickedIdx[pickedIdx.length - 1] + 1

      const idxToHm = (idx: number) => {
        const totalMin = idx * SLOT_MIN
        const hh = Math.floor(totalMin / 60)
        const mm = totalMin % 60
        return { hh, mm }
      }

      const s = idxToHm(minIdx)
      const e = idxToHm(maxIdx)

      startIso = toUtcIsoFromLocal(iso, s.hh, s.mm)
      endIso = toUtcIsoFromLocal(iso, e.hh, e.mm)
    }

    const { error: updErr } = await supabase
      .from('rooms')
      .update({
        finalized_time_start: startIso,
        finalized_time_end: endIso
      })
      .eq('id', props.room.id)

    if (updErr) throw updErr

    toast.success('날짜/시간이 확정되었습니다')
    await reloadAll()
    
    // ✅ 부모에게 room refresh 요청
    emit('refresh-room')
  } catch (e: any) {
    error.value = e?.message || '확정에 실패했습니다'
    toast.error(error.value)
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
  }
}

/**
 * 확정된 시간 표시
 */
const finalizedText = computed(() => {
  const s = (props.room as any).finalized_time_start as string | null | undefined
  const e = (props.room as any).finalized_time_end as string | null | undefined
  if (!s || !e) return ''
  try {
    const ds = new Date(s)
    const de = new Date(e)
    if (Number.isNaN(ds.getTime()) || Number.isNaN(de.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = ds.getFullYear()
    const m = pad(ds.getMonth() + 1)
    const d = pad(ds.getDate())
    const sh = pad(ds.getHours())
    const sm = pad(ds.getMinutes())
    const eh = pad(de.getHours())
    const em = pad(de.getMinutes())
    return `${y}-${m}-${d} ${sh}:${sm} ~ ${eh}:${em}`
  } catch {
    return ''
  }
})

onMounted(() => {
  Promise.all([loadHost(), reloadAll()]).catch((e) => {
    if (import.meta.dev) console.error(e)
  })
})
</script>

<style scoped>
.time-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.section {
  background: #fff;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  color: #333;
}

.range-row {
  display: flex;
  gap: 0.75rem;
  align-items: end;
  flex-wrap: wrap;
}
.range-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
label {
  font-size: 0.85rem;
  color: #555;
}
input[type='date'] {
  padding: 0.6rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}
.btn-primary {
  padding: 0.7rem 1rem;
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  padding: 0.7rem 1rem;
  background: #f3f4f6;
  color: #333;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.btn-ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-finalize {
  padding: 0.7rem 1rem;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}
.btn-finalize:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.hint {
  margin-top: 0.75rem;
  color: #777;
  font-size: 0.85rem;
  line-height: 1.35;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

@media (max-width: 480px) {
  .calendar-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 481px) and (max-width: 768px) {
  .calendar-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.day-cell {
  border: 1px solid #eee;
  background: #fafafa;
  border-radius: 10px;
  padding: 0.6rem;
  text-align: left;
  cursor: pointer;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.day-cell.active {
  outline: 2px solid #007bff;
  background: #f2f7ff;
}
.day-cell.disabled {
  opacity: 0.85;
}

.day-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #333;
}
.day-label .wd {
  color: #888;
}

.badge {
  align-self: flex-start;
  margin-top: 0.35rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #007bff;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}

.all-day-row {
  margin: 0.25rem 0 0.75rem;
}
.all-day {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #444;
}
.all-day input {
  width: 16px;
  height: 16px;
}

.heatmap {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.slot {
  border: 1px solid #eee;
  background: #fafafa;
  border-radius: 10px;
  padding: 0.6rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.slot.picked {
  outline: 2px solid #007bff;
  background: #f2f7ff;
}

.slot.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slot[data-level='0'] {
  opacity: 0.6;
}
.slot[data-level='2'] {
  border-color: #cfe3ff;
}
.slot[data-level='3'] {
  border-color: #9fc7ff;
}
.slot[data-level='4'] {
  border-color: #5aa0ff;
}

.slot-time {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}
.slot-count {
  color: #666;
  font-size: 0.85rem;
}

.actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.empty-state {
  color: #888;
  text-align: center;
  padding: 1rem;
}
.error-message {
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  font-size: 0.9rem;
}

.finalized-box {
  margin-top: 0.75rem;
  padding: 0.9rem;
  border-radius: 10px;
  border: 1px solid #dcfce7;
  background: #f0fdf4;
}
.finalized-title {
  font-size: 0.85rem;
  color: #166534;
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.finalized-value {
  font-size: 0.95rem;
  color: #14532d;
  font-weight: 700;
}

.hint-danger {
  color: #dc2626;
  font-weight: 500;
}
</style>
