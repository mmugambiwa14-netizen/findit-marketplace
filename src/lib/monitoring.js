const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim()

let sentryClientPromise

export function initializeMonitoring() {
  if (!sentryDsn) return Promise.resolve(null)

  sentryClientPromise ??= import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim()
        || import.meta.env.VITE_DEPLOY_ENV?.trim()
        || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    })

    return Sentry
  })

  return sentryClientPromise
}

export function reportError(error, context = {}) {
  if (!sentryDsn) return

  void initializeMonitoring()
    .then((Sentry) => Sentry?.captureException(error, { contexts: { application: context } }))
    .catch((monitoringError) => {
      console.error('PeekaListing monitoring delivery failed:', monitoringError)
    })
}
