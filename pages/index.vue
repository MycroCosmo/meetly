<template>
  <div class="home-page">
    <div class="container">
      <h1>Meetly</h1>
      <p class="subtitle">그룹 스케줄링을 위한 간단한 도구</p>

      <div class="actions">
        <NuxtLink to="/create" class="btn-primary">새 모임 만들기</NuxtLink>
      </div>

      <div class="join-box">
        <input
          v-model="roomCode"
          placeholder="방 코드 입력"
          autocomplete="off"
          @keyup.enter="checkAndGo"
        />

        <button class="btn-secondary" @click="checkAndGo" :disabled="loading">
          {{ loading ? '확인 중...' : '입장' }}
        </button>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabase()
const router = useRouter()

const roomCode = ref('')
const loading = ref(false)
const errorMessage = ref('')

const normalizeCode = (v: string) => v.trim().toLowerCase()

const checkAndGo = async () => {
  const code = normalizeCode(roomCode.value)
  if (!code) return

  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      errorMessage.value = '모임을 찾을 수 없습니다'
      return
    }

    router.push(`/m/${code}`)
  } catch (e: any) {
    errorMessage.value = e?.message || '모임 확인에 실패했습니다'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.container { max-width: 600px; text-align: center; }
h1 { font-size: 3rem; margin-bottom: 1rem; font-weight: 700; }
.subtitle { font-size: 1.25rem; margin-bottom: 2rem; opacity: 0.9; }

.actions { margin-bottom: 2rem; }
.btn-primary {
  display: inline-block;
  padding: 1rem 2rem;
  background: white;
  color: #667eea;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
}

.join-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.join-box input {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
}
.btn-secondary {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
.error-message {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 0, 0, 0.12);
  border-radius: 10px;
}
</style>
