import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import '@/findit-locked-design.css'
import '@/pwa-viewport.css'

const STAGING_BUILD = 'staging-submit-trace-v5'
document.documentElement.dataset.peekalistingBuild = STAGING_BUILD

function stagingLikeOrigin() {
  const explicitPreview = String(import.meta.env.VITE_PREVIEW_DEPLOYMENT || '').trim().toLowerCase() === 'true'
  const hostname = String(window.location.hostname || '').trim().toLowerCase()
  return explicitPreview
    || hostname.includes('staging')
    || hostname.startsWith('findit-marketplace-stagi')
    || hostname.startsWith('peekalisting-stagi')
}

function installStagingSubmissionTrace() {
  if (!stagingLikeOrigin()) return

  const watchedLabels = new Set([
    'Submit request',
    'I want this too',
    'Already interested',
    'Show answered request',
    'Submit application',
    'Send information',
    'Submit advertising request',
  ])
  let traceElement = null
  let lastRpcStartedAt = 0

  const show = (message, phase = 'info') => {
    if (!traceElement) {
      traceElement = document.createElement('div')
      traceElement.id = 'peekalisting-staging-submit-trace'
      traceElement.setAttribute('role', 'status')
      traceElement.setAttribute('aria-live', 'polite')
      Object.assign(traceElement.style, {
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: '76px',
        zIndex: '2147483647',
        padding: '10px 12px',
        borderRadius: '12px',
        background: 'rgba(7, 17, 31, 0.96)',
        color: '#ffffff',
        font: '600 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.32)',
        pointerEvents: 'none',
      })
      document.body.appendChild(traceElement)
    }
    traceElement.dataset.phase = phase
    traceElement.textContent = `${STAGING_BUILD}: ${message}`
  }

  const installVisibleMarker = () => show('canonical preview build loaded', 'ready')
  if (document.body) installVisibleMarker()
  else window.addEventListener('DOMContentLoaded', installVisibleMarker, { once: true })

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null
    if (!target) return
    const label = String(target.textContent || '').replace(/\s+/g, ' ').trim()
    if (!watchedLabels.has(label)) return

    const tapAt = Date.now()
    show(`Tap received: ${label}`, 'tap')
    window.setTimeout(() => {
      if (lastRpcStartedAt < tapAt) {
        show(`No submission RPC started after: ${label}`, 'blocked')
      }
    }, 1400)
  }, true)

  window.addEventListener('peekalisting:submission-diagnostic', (event) => {
    const detail = event.detail || {}
    if (detail.phase === 'sending') lastRpcStartedAt = Number(detail.at || Date.now())
    show(detail.message || 'Submission diagnostic event received', detail.phase || 'info')
  })
}

installStagingSubmissionTrace()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('PeekaListing startup failed: root element is unavailable')
}

const root = ReactDOM.createRoot(rootElement)

function StartupFailure() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg" aria-labelledby="startup-error-title">
        <h1 id="startup-error-title" className="text-2xl font-bold">PeekaListing preview could not start</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This preview is missing required staging configuration or could not load one of its application files. No marketplace data has been changed.
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

    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    )
  } catch (error) {
    console.error('PeekaListing application bootstrap failed:', error)
    root.render(<StartupFailure />)
  }
}

bootstrap()
