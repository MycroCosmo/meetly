<template>
  <div class="lp">
    <div class="card" role="status" aria-live="polite">
      <div class="top">
        <div class="spinner" />
        <div class="txt">
          <p class="title">{{ title }}</p>
          <p class="sub">{{ subtitle }}</p>
        </div>
      </div>

      <div class="skeleton">
        <div class="line w60" />
        <div class="line w90" />
        <div class="line w75" />
        <div class="line w40" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
  }>(),
  {
    title: '불러오는 중…',
    subtitle: '잠시만 기다려주세요'
  }
)
</script>

<style scoped>
.lp {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f5f5;
  padding: 1.25rem;
}

.card {
  width: min(520px, 100%);
  background: #fff;
  border: 1px solid #eee;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  padding: 1rem 1rem 1.25rem;
}

.top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  animation: spin 0.85s linear infinite;
  flex: 0 0 auto;
}

.txt {
  min-width: 0;
}

.title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #111827;
}

.sub {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  color: #6b7280;
}

.skeleton {
  display: grid;
  gap: 0.55rem;
}

.line {
  height: 12px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 40%, #f3f4f6 80%);
  background-size: 200% 100%;
  animation: shimmer 1.1s ease-in-out infinite;
}

.w40 { width: 40%; }
.w60 { width: 60%; }
.w75 { width: 75%; }
.w90 { width: 90%; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: -200% 0; }
}
</style>
