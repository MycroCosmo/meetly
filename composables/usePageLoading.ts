// ~/composables/usePageLoading.ts
export const usePageLoading = () => {
  const count = useState<number>('pageLoadingCount', () => 0)

  const loading = computed(() => count.value > 0)

  const start = () => { count.value += 1 }
  const end = () => { count.value = Math.max(0, count.value - 1) }
  const reset = () => { count.value = 0 }

  return { loading, start, end, reset }
}
