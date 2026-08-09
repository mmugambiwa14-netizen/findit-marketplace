import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import '@/findit-locked-design.css'
import '@/pwa-viewport.css'

document.documentElement.dataset.peekalistingBuild = 'staging-buttons-v3'

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
