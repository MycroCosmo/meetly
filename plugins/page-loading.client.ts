// ~/plugins/page-loading.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  const { start, end, reset } = usePageLoading()
  const router = useRouter()

  nuxtApp.hook('page:start', start)
  nuxtApp.hook('page:finish', end)
  nuxtApp.hook('app:error', () => reset())

  router.beforeEach(() => start())
  router.afterEach(() => end())
  router.onError(() => reset())
})
