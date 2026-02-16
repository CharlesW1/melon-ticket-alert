
## 2026-02-11 - Optimize Polling Scripts with Session and Layout Caching
**Learning:** Polling scripts that make many sequential requests to the same host suffer significantly from TCP/TLS handshake overhead. Using `requests.Session()` provides a major speed boost through connection pooling. Additionally, static data like seat block layouts should be fetched once and cached outside the polling loop.
**Action:** Always use `requests.Session()` for scrapers/pollers and identify static vs. dynamic API calls to minimize redundant network I/O.

## 2026-02-11 - JavaScript Monitor Optimization
**Learning:** Browser console scripts often suffer from "spammability" and memory churn. Using a simple Map for state tracking (seat counts) prevents redundant network notifications. Also, manual loops for counting are more efficient than .filter().length for large seat maps as they avoid temporary array allocations.
**Action:** Use state tracking to deduplicate notifications and avoid array-allocating methods in high-frequency monitoring loops.

## 2026-02-11 - Dynamic Frequency Scaling for Priority Monitoring
**Learning:** In high-stakes monitoring scenarios like ticket sales, users value frequency over deduplication. Implementing an "interleaved" loop that visits priority items (active openings) twice as often, combined with reduced throttles, meets user needs for real-time responsiveness without overloading the server for inactive segments.
**Action:** Design monitoring loops to dynamically adjust frequency based on item state (e.g. priority queue or interleaving).

## 2026-02-16 - Safety in Dynamic Priority Loops
**Learning:** When using a priority queue or interleaved list that is dynamically recalculated (e.g. via .filter()), always ensure that any tracking indices (like priorityBlockIndex) are bounds-checked or reset if the list shrinks. Failure to do so leads to TypeErrors when accessing out-of-bounds elements.
**Action:** Use modulo or explicit bounds checking when iterating over dynamically filtered lists.
