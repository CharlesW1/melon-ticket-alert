## 2025-02-13 - Session Isolation for Performance and Safety
**Learning:** Using a single `requests.Session()` with hardcoded `Host` headers for both the primary API and external webhooks (like Slack) causes functional regressions and security leaks. The `Host` header causes other destinations to reject the request, and sensitive cookies are leaked to the webhook endpoint.
**Action:** Use separate sessions or simple `requests.post()` for external webhooks when the primary session has host-specific or sensitive configuration.

## 2025-02-13 - Loop Hoisting for Monitoring Scripts
**Learning:** Fetching static data (like venue block maps) inside a high-frequency monitoring loop creates unnecessary network overhead.
**Action:** Always identify static vs. dynamic data and hoist static API calls outside the monitoring loop.
