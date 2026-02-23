# Risk & Severity Matrix — HandeePOS Architecture Audit

## Executive Summary

This matrix consolidates risks identified across the **mobile offline**, **backend sync**, **inventory consistency**, and **blueprint gap** audits. Each risk is rated by **layer**, **severity**, **likelihood** (in typical low-connectivity / multi-device POS use), **impact**, and **notes**. The highest concentration of **Critical** and **High** risks is in the **sync and offline order path** (broken push due to productId, no idempotency, no local inventory update) and **inventory consistency** (negative stock possible, no reservation). Use this matrix to prioritize remediation for production deployment, especially in regions with unreliable networks and multiple devices per store.

---

## Risk Matrix Table

| Risk | Layer | Severity | Likelihood | Impact | Notes |
|------|--------|-----------|------------|--------|--------|
| Offline order push fails (local productId sent to server) | Mobile / Sync | Critical | Certain in offline flow | Loss of order data on server; reporting wrong; no central record | Backend expects MongoDB ObjectId; client sends local id. Every offline order sync fails. |
| Local inventory not decremented on offline sale | Mobile / Inventory | Critical | Certain on offline sale | Stale local stock; oversell or incorrect “out of stock”; confusion after sync | createOrder only inserts order; no product stock update. |
| No idempotency on order create (duplicate on retry) | Backend / Sync | Critical | High (timeouts, flaky network) | Duplicate orders; double inventory deduction; wrong revenue | POST /api/orders has no idempotency key; retries create new order. |
| Sync queue item marked “syncing” never retried if app crashes | Mobile / Sync | High | Medium (crashes, kill) | One or more operations never sync; permanent gap | getPendingSyncItems only returns status=pending; “syncing” stuck forever. |
| No transactional boundary (order insert + enqueue) | Mobile / Local DB | High | Medium (kill during write) | Orphan order (in DB but not in queue) or inconsistent state | Two separate writes; no atomicity. |
| Full pull only (no incremental / lastSync) | Backend + Mobile | High | Certain at scale | Slow sync; high bandwidth; poor UX with large catalogs | GET /api/products and categories with no cursor or updatedAfter. |
| Local order not updated with serverId / server orderNumber after push | Mobile / Sync | High | Certain on successful push | Local and server diverge; reconciliation and reporting harder | syncOrder does not update local order row after POST. |
| cashierId sent as "current_user" from mobile | Mobile / Order | High | Certain for offline orders | Backend validation/DB error or wrong attribution | orderStore uses literal "current_user"; backend expects ObjectId. |
| Dedicated sync API (push/pull/status) not implemented | Backend | High | N/A (design gap) | No single place for idempotency, batching, versioning | Blueprint describes /api/sync/*; routes not mounted. |
| syncVersion present but never used for conflict resolution | Backend / Sync | High | N/A (unused) | Cannot implement last-write-wins or optimistic locking | Product.syncVersion incremented on save; no API checks it. |
| Negative stock under concurrent or duplicate order requests | Backend / Inventory | Critical | Medium (multi-device, retry) | Negative stock; impossible picks; wrong reports | $inc without conditional “only if stock >= quantity”; two requests can both decrement. |
| No inventory reservation (hold between cart and payment) | Backend / Inventory | High | High under concurrency | Oversell of last units when many devices/tabs | Stock decremented only at order create; no reserve/release. |
| Manual stock update overwrites (no delta, no adjustment log) | Backend / Inventory | High | Certain when adjusting | Races with order creation; no audit trail for adjustments | updateStock sets stockQuantity; no transaction log. |
| Cancel order restores stock but not payment/refund | Backend / Order | High | When cancel used | Financial and inventory diverge; refund not recorded | cancelOrder $inc restores stock; no payment gateway or ledger. |
| No deviceId or idempotency key in order payload | Mobile / Sync | Medium | Certain | Multi-device attribution and dedup limited | deviceId optional; not sent; no client request id. |
| Order number format mismatch (client vs server) | Mobile + Backend | Medium | Certain | Two numbers for same order; receipt vs server report differ | Client ORD-{timestamp}; server ORD-YYYYMMDD-NNN. |
| No background sync worker (sync only on reconnect / manual) | Mobile | Medium | Certain | Large backlog after long offline; no automatic drain | syncAll only on setOnlineStatus(true) or user trigger. |
| No recovery of “syncing” queue items (stale state) | Mobile | High | Medium | Operations left in “syncing” never retried | No cron or startup logic to reset stale syncing → pending. |
| Drizzle vs WatermelonDB (blueprint) | Mobile | Low | N/A | Different migration and observability path | Implementation choice; not a correctness risk. |
| Payment confirmed locally but sync never succeeds | Mobile / Sync | High | High in low-connectivity | Money taken; order only on device; no server record | No reconciliation path (e.g. manual export, webhook). |
| Two devices sell “last unit” offline then sync | Mobile + Backend | High | Medium (multi-device) | One order fails “Insufficient stock” or negative stock | No reservation; both decrement locally then push; server serializes. |
| No inventory adjustment transaction log (blueprint) | Backend | Medium | N/A | No audit trail; harder reconciliation | Blueprint asks for adjustment log; not implemented. |
| Product schema min:0 not enforced on $inc result | Backend | Critical | When concurrent/duplicate | Negative stock possible | MongoDB $inc can go negative; schema validate not applied same way. |

---

## Severity Definitions (Used in This Audit)

- **Critical**: System or data correctness failure; data loss; security or financial impact; blocks core flow (e.g. offline orders never sync).
- **High**: Significant incorrect behavior or divergence from design; recoverable but with operational cost; multi-device or scale issues.
- **Medium**: Degraded UX or performance; missing feature vs blueprint; workaround possible.
- **Low**: Minor deviation or tech choice; no direct correctness impact.

---

## Likelihood (Context: Low-Connectivity, Multi-Device POS)

- **Certain**: Occurs whenever the relevant code path runs (e.g. every offline order, every sync).
- **High**: Expected in production under normal load (retries, multiple devices, long offline).
- **Medium**: Requires specific failure or timing (crash, kill, two devices selling same SKU at once).
- **N/A**: Design or code gap, not a runtime likelihood.

---

## Impact (Short Form)

- **Loss of order data / no sync**: Server never sees order; reporting and central inventory wrong.
- **Duplicate orders / double decrement**: Wrong revenue and stock; possible negative stock.
- **Stale or wrong local stock**: Oversell or false “out of stock”; trust and operations.
- **Negative stock**: Impossible picks; incorrect reports; compliance.
- **Orphaned or stuck operations**: Orders or queue items never synced; manual reconciliation.
- **Financial vs inventory divergence**: Cancel/refund not aligned with stock restore.

---

## Recommended Priority Order (for Remediation)

1. **Fix offline order sync**: Map local productId → serverId before sending order payload (or accept client order id + mapping on server).
2. **Decrement local inventory** on offline order create (and reconcile with server on pull).
3. **Add idempotency** for order create (client idempotency key; server returns 200 + same body on replay).
4. **Prevent negative stock**: Conditional update, e.g. `findOneAndUpdate` with `stockQuantity: { $gte: quantity }` and `$inc`, abort transaction if no match.
5. **Recover “syncing” queue items**: On startup or periodically, set status syncing → pending for items older than T (e.g. 5 min).
6. **Transactional “order + enqueue”** on client (single SQLite transaction or equivalent).
7. **Use cashierId from auth** (real userId), not "current_user".
8. **Update local order with serverId and server orderNumber** after successful push.
9. **Implement dedicated sync API** (push/pull/status) with batch and optional lastSync/cursor.
10. **Use syncVersion** for product updates (conditional update or conflict resolution).

---

*This matrix is derived from the mobile-offline, backend-sync, inventory-consistency, and architecture-gap audits. No code was modified.*
