## 2026-02-14 - [Optimizing Ticketing Monitor Performance]
**Learning:** In I/O-bound monitoring scripts, the primary bottlenecks are TCP/TLS handshakes and sequential request execution. Using `requests.Session` for connection pooling and `ThreadPoolExecutor` for parallelism can reduce iteration time by over 90% (measured 9x speedup in local benchmarks).
**Action:** Always prefer `requests.Session()` for repeated API calls and parallelize independent network requests using a long-lived `ThreadPoolExecutor`.

## 2026-02-14 - [Session Pollution with Host Headers]
**Learning:** Setting host-specific headers (like 'Host') on a `requests.Session` can cause subsequent requests to external domains (e.g., Slack/Discord webhooks) to fail with 403 Forbidden errors because the session-level header persists.
**Action:** Use separate sessions for different hosts or use direct `requests.post` calls for one-off external notifications while using a session for the target API.
