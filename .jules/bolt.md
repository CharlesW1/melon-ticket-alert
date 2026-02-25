
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

## 2026-02-16 - Frequency-Based Priority Polling
**Learning:** For monitoring systems where some targets are more "active" than others, a simple interleaved loop using a frequency multiplier (e.g., check priority every 3rd request) is more configurable and predictable than complex priority queues. It allows users to tune the "extra" load they put on the system for priority targets.
**Action:** Use a modulo-based request counter to interleave priority checks at a fixed ratio.

## 2026-02-16 - Timestamp-Based Priority Scheduling
**Learning:** For dynamic priority monitoring (where items enter and leave the priority set), an index-based rotation is fragile. Storing and selecting the "oldest" last-checked timestamp ensures a fair and robust rotation that handles additions and removals from the priority set without skipping or duplicating items.
**Action:** Use timestamps to manage rotation in dynamic polling sets.

## 2026-02-17 - Fast-Path Heuristics for Large JSON Payloads
**Learning:** When polling an API where most responses indicate no state change (e.g., 0 seats), a simple `string.includes()` check on the raw response text can bypass expensive `JSON.parse()` and object traversal. This is especially effective in browser console scripts where CPU and memory churn should be minimized.
**Action:** Use string-based heuristics to fast-path out of expensive processing for "empty" or "no-change" API responses.
