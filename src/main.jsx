import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import '@/findit-locked-design.css'
import '@/pwa-viewport.css'

const rootElement = document.getElementById('root')
const PREVIEW_RECOVERY_PREFIX = '__peekalisting_preview_boot_recovery:'
const PREVIEW_RECOVERY_PARAM = '__preview_recover'

if (!rootElement) {
  throw new Error('PeekaListing startup failed: root element is unavailable')
}

const root = ReactDOM.createRoot(rootElement)

function isPreviewDeployment() {
  return import.meta.env.VITE_VERCEL_ENV === 'preview'
    || import.meta.env.VITE_VERCEL_TARGET_ENV === 'preview'
}

function currentBootAssetId() {
  const entry = document.querySelector('script[type="module"][src*="/assets/"]')
  return entry?.getAttribute('src') || window.location.pathname
}

async function recoverPreviewBootOnce() {
  if (!isPreviewDeployment()) return false

  const recoveryKey = `${PREVIEW_RECOVERY_PREFIX}${currentBootAssetId()}`
  if (window.sessionStorage.getItem(recoveryKey) === '1') return false
  window.sessionStorage.setItem(recoveryKey, '1')

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }

    if ('caches' in window) {
      const cacheNames = await window.caches.keys()
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('findit-') || name.startsWith('peekalisting-'))
          .map((name) => window.caches.delete(name))
      )
    }
  } catch (cleanupError) {
    console.warn('PeekaListing preview cleanup was incomplete:', cleanupError)
  }

  const recoveryUrl = new URL(window.location.href)
  recoveryUrl.searchParams.set(PREVIEW_RECOVERY_PARAM, Date.now().toString())
  window.location.replace(recoveryUrl.toString())
  return true
}

function removeRecoveryParameter() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PREVIEW_RECOVERY_PARAM)) return
  url.searchParams.delete(PREVIEW_RECOVERY_PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
}

function StartupFailure() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg" aria-labelledby="startup-error-title">
        <h1 id="startup-error-title" className="text-2xl font-bold">PeekaListing preview could not start</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The preview could not load one of its application files. No marketplace data has been changed.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Reload preview
        </button>
      </section>
    </main>
  )
}

async function bootstrap() {
  try {
    const [{ default: App }, { default: AppErrorBoundary }] = await Promise.all([
      import('@/App.jsx'),
      import('@/components/AppErrorBoundary.jsx'),
    ])

    removeRecoveryParameter()
    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    )
  } catch (error) {
    console.error('PeekaListing application bootstrap failed:', error)
    if (await recoverPreviewBootOnce()) return
    root.render(<StartupFailure />)
  }
}

bootstrap()
