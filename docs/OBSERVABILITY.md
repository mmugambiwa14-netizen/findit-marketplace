# Observability, Logging, and Monitoring

Status: **repository telemetry complete for the release candidate; external delivery requires staging and production configuration**

## Implemented aggregate signals

Migrations `0040`–`0042` store compact hourly aggregates for:

- Tour upload intent, completion and abandonment;
- processing dispatch, completion latency and failure;
- cleanup and cache-invalidation completion/failure;
- public Tour feed latency, response size and failures;
- signed playback access latency and failures;
- Tour report volume;
- server-side message-send latency;
- essential-notification fan-out claims, completion latency, failure, pending/claimed/dead-letter queue gauges and stale claims.

The aggregate tables do not store message bodies, listing titles, recipient identities, contact details, IP addresses, tokens, filenames or storage paths. Browser roles cannot read the raw metric or queue tables.

## Deterministic alerts

The observability worker evaluates:

- Tour processing failure rate;
- abandoned uploads;
- feed and message latency/failure thresholds;
- cleanup and cache dead letters;
- notification fan-out dead letters, backlog age/volume and stale claims.

The founder dashboard reads aggregate metrics, open alerts, retained-byte snapshots and queue snapshots. It does not perform a full Tour or notification-recipient scan on every page load.

## Retention

- Operational metric retention is 90 days.
- Completed notification fan-out jobs are pruned only by a service-role function within a bounded 7–365 day safety window.
- Dead-letter jobs and open incident evidence remain until explicitly reviewed.

## External configuration still required

Configure a named alert owner and delivery destination for frontend errors, Web Vitals, Edge Function failures, database connections/locks/slow queries, Auth/email failures, storage bandwidth/costs, backup age and restore breaches.

Never send credentials, full messages, uploaded media or unnecessary personal data to an observability provider.

## Release gate

In staging, deliberately exercise representative processing, playback, cleanup, cache, message and notification fan-out failure conditions. Confirm alerts open, resolve after recovery and appear in the retained acceptance evidence.
