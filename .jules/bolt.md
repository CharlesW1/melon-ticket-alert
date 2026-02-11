
## 2026-02-11 - Optimize Polling Scripts with Session and Layout Caching
**Learning:** Polling scripts that make many sequential requests to the same host suffer significantly from TCP/TLS handshake overhead. Using `requests.Session()` provides a major speed boost through connection pooling. Additionally, static data like seat block layouts should be fetched once and cached outside the polling loop.
**Action:** Always use `requests.Session()` for scrapers/pollers and identify static vs. dynamic API calls to minimize redundant network I/O.

## 2026-02-11 - JavaScript Monitor Optimization
**Learning:** Browser console scripts often suffer from "spammability" and memory churn. Using a simple Map for state tracking (seat counts) prevents redundant network notifications. Also, manual loops for counting are more efficient than .filter().length for large seat maps as they avoid temporary array allocations.
**Action:** Use state tracking to deduplicate notifications and avoid array-allocating methods in high-frequency monitoring loops.
