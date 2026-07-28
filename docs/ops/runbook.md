# Observability Runbook

## Signals

- Errors: `captureException` emits scrubbed JSON with `event=exception` and forwards to `OBSERVABILITY_INGEST_URL` or `NEXT_PUBLIC_OBSERVABILITY_INGEST_URL` when configured.
- Logs: API routes include `x-request-id`; production JSON logs should be shipped from stdout/stderr to the hosting log drain.
- Metrics: `recordMetric` emits JSON metric events for `issuance.success`, `issuance.failure`, `verification.attempt`, `ipfs.pin_file.latency_ms`, `ipfs.pin_file.error`, `ipfs.pin_json.latency_ms`, and `ipfs.pin_json.error`.

## Dashboards

- Issuance volume: count `issuance.success` and `issuance.failure` by hour.
- Verification volume: count `verification.attempt` grouped by `context.resultType`.
- IPFS health: p95 `ipfs.pin_file.latency_ms` / `ipfs.pin_json.latency_ms` and error counts by status.
- API errors: count `event=exception` grouped by `context.context` and `context.requestId`.

## Alerts

- Page on-call if `event=exception` is greater than 5 events in 5 minutes.
- Page on-call if any public API uptime check fails 3 times in a row.
- Page on-call if IPFS error metrics are greater than 3 in 10 minutes or p95 latency is above 10 seconds for 10 minutes.
- Warn during business hours if `issuance.failure / (issuance.success + issuance.failure)` is above 10% for 15 minutes.

## Triage

1. Find the alert's `requestId`, route context, and deployment version in the log aggregator.
2. Check whether failures are isolated to Supabase, Stellar RPC, or Pinata/IPFS.
3. For verification failures, compare `verification.attempt` result types against `/api/admin/stats`.
4. If RPC/IPFS is degraded, switch traffic to a known-good provider endpoint and redeploy.
5. After mitigation, leave an incident note with root cause, customer impact, and follow-up tasks.

## Smoke Test

1. Configure the ingest endpoint in production secrets.
2. Trigger a controlled server error in a non-production deployment.
3. Confirm the exception appears in the tracker within seconds with scrubbed context and a request ID.
4. Run one credential verification and confirm dashboard volume increments.
