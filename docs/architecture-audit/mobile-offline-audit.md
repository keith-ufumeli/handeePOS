# Mobile Offline & Sync Layer — Architecture Audit

## Executive Summary

The mobile app implements an **offline-capable** POS using **SQLite (Drizzle)** for local storage and a **queue-based sync** that replays pending operations via standard REST endpoints. There is **no dedicated sync API** (no `/api/sync/push` or `/api/sync/pull`); sync is implemented as sequential per-entity API calls. The implementation **deviates from the technical blueprint** (which specifies WatermelonDB and explicit sync endpoints) and contains **critical gaps**: offline orders cannot sync successfully because **productIds in order items are local IDs**, the server expects MongoDB ObjectIds, and there is **no local-to-server ID mapping** on push. Local inventory is **not decremented** on offline checkout, so local stock is wrong until the next full pull. There is **no write-ahead logging**, **no transactional boundary** around “create order + enqueue sync,” and **no idempotency** for sync operations, leading to duplicate or lost orders under failure. **Severity: High to Critical** for production use in low-connectivity regions.

---

## Current Implementation Summary

### Local Storage

- **Technology**: **Drizzle ORM + expo-sqlite** (SQLite). The blueprint recommends WatermelonDB; the codebase uses Drizzle with a single SQLite file `handeepos_v2.db`.
- **Tables**: `products`, `categories`, `orders`, `sync_queue`. Schema includes `sync_status`, `server_id`, `last_synced_at` for sync metadata.
- **IDs**: Local IDs are generated with `Date.now()-random` (e.g. `1734567890123-abc123def`) in `database/index.ts` via `generateId()`.
- **Persistence**: Single DB instance; `PRAGMA foreign_keys = ON`. No explicit WAL mode or durability guarantees documented in code.

### Sync Engine (syncService.ts)

- **Push**: Iterates `getPendingSyncItems()` (status = `pending`), marks item `syncing`, calls:
  - **Orders**: `POST /api/orders` with queue item `data` (no transformation).
  - **Products**: `POST/PUT/DELETE /api/products` (or categories) with lookup of `serverId` for updates/deletes.
- Then marks item `completed` or `failed` (with `retryCount` increment), then runs **pull**.
- **Pull**: `GET /api/products` and `GET /api/products/categories` with **no** `lastSync` or cursor; full list each time. Results are merged into local DB by `serverId` (upsert by server id).
- **Order sync**: Does **not** map local `productId` in items to server `productId`; payload is sent as stored in the queue (local IDs).
- **Post-sync**: Local order is **not** updated with `serverId` or server-generated `orderNumber` after successful push.

### Sync Queue

- **Schema**: `id`, `operation`, `collection`, `document_id`, `data` (JSON), `status`, `retry_count`, `error_message`, `timestamp`.
- **Status flow**: `pending` → `syncing` → `completed` | `failed`. Only `pending` items are processed.
- **No idempotency key**: No client-generated request ID or idempotency key; retries create duplicate server-side entities if the first request succeeded but response was lost.
- **Ordering**: Items processed in `timestamp` ascending order; no explicit dependency ordering between orders and product updates.

### State Management

- **syncStore (Zustand)**: Tracks `syncStatus`, `pendingCount`, `lastSyncTime`, `isOnline`. On `setOnlineStatus(true)` triggers `syncAll()`. No background worker; sync is on-demand and on reconnect.
- **orderStore**: `createOrder` writes order to local DB, then `syncService.addToSyncQueue('create', 'orders', newOrder.id, { ...cartItems, orderNumber: ORD-${Date.now()}, ... })`. Cart items use **product.id** (local product id).
- **Connectivity**: `@react-native-community/netinfo`; `SyncStatusProvider` sets `setOnlineStatus(netInfo.isConnected ?? false)`.

### Local Order Creation

- **orderStore.createOrder**: Computes totals, generates `orderNumber = 'ORD-' + Date.now()`, calls `dbHelpers.createOrder(...)` then `syncService.addToSyncQueue('create', 'orders', ...)` with payload containing `items: cartItems` (each with `productId: product.id` — local).
- **Local inventory**: `db-helpers.createOrder` only inserts into `orders`; **no** update to `products.stock_quantity`. Offline sales do **not** reduce local stock.

---

## Identified Weaknesses

### Critical

1. **Offline order sync is broken (productId mismatch)**  
   Order sync sends `items[].productId` as the **local** product id (e.g. `1734567890123-xyz`). Backend `OrderController.createOrder` looks up `Product.findOne({ _id: item.productId, storeId })`. MongoDB `_id` is 24-char hex; local id format does not match. Result: **"Product not found or inactive"** for every offline order push. Offline orders **never** sync successfully.

2. **No local inventory update on offline sale**  
   Creating an order offline does not decrement `products.stock_quantity` in the local DB. Local catalog shows stale stock until next pull; if pull is delayed or fails, cashiers can sell “phantom” stock.

3. **No idempotency for sync operations**  
   If `POST /api/orders` succeeds but the client crashes before marking the queue item `completed`, the item stays `pending` (or `syncing`). Next run will push the same order again. Server has no idempotency key to deduplicate; **duplicate orders** and **double inventory deduction** are possible.

### High

4. **No transactional boundary for “create order + enqueue”**  
   Order is written to SQLite, then sync queue item is added. If the app is killed after insert and before `addToSyncQueue`, the order exists locally but is **never** queued for sync (orphan). If killed after enqueue but before commit, inconsistent state.

5. **Sync queue “syncing” state is not recovered**  
   Items are set to `syncing` before the API call. If the process dies during the request, they remain `syncing` and are **not** in `getPendingSyncItems()` (which filters `status = 'pending'`). Those items are **never retried** unless logic is added to reset stale `syncing` to `pending`.

6. **Full pull every time, no incremental sync**  
   Pull uses `GET /api/products` and `GET /api/products/categories` with no `lastSync` or `updatedAfter`. All products/categories are fetched and merged every sync. At scale this is expensive and slow; no delta sync or cursor.

7. **Local order never updated with server identity**  
   After a successful order push, the server returns the created order (with `_id`, server `orderNumber`). The client does not update the local order row with `serverId` or the server `orderNumber`. Local and server diverge; reporting and reconciliation are harder.

8. **cashierId sent as literal "current_user"**  
   `orderStore.createOrder` passes `cashierId: "current_user"` with a TODO. Backend expects a valid user ObjectId; this will cause validation/DB errors or wrong attribution.

### Medium

9. **No background sync worker**  
   Sync runs only when the app is in foreground and user triggers sync or when `setOnlineStatus(true)` fires. No periodic background sync; long offline periods can build large queues with no automatic drain.

10. **No conflict resolution on pull**  
    Pull overwrites local products/categories by `serverId`. No `syncVersion` or last-write-wins comparison; server always wins. Blueprint’s “Inventory: quantity adjustments with transaction log” is not implemented; pull is full overwrite.

11. **Order number format mismatch**  
    Mobile uses `ORD-${Date.now()}` (e.g. `ORD-1734567890123`). Server generates `ORD-YYYYMMDD-NNN`. Local receipt and records show one number; server another. No mapping stored locally.

12. **Retry limit only in type/computed**  
    `syncQueueFromDb` sets `canRetry = isFailed && retryCount < 3`. There is no automatic retry with backoff or removal of permanently failed items; UX handling of “failed” is not fully clear.

### Low

13. **No device identifier in sync payload**  
    Backend Order model has `deviceId`; mobile does not send a stable deviceId in the order payload (orderStore sync data does not include it). Multi-device attribution and debugging are limited.

14. **Drizzle vs blueprint (WatermelonDB)**  
    Blueprint specifies WatermelonDB for React Native. Implementation uses Drizzle + SQLite. Functional but different observability and migration path.

---

## Severity Rating

| Weakness | Severity |
|----------|----------|
| Offline order sync broken (productId) | **Critical** |
| No local inventory update on offline sale | **Critical** |
| No idempotency for sync | **Critical** |
| No transaction (order + enqueue) | **High** |
| Syncing state not recovered | **High** |
| Full pull only, no incremental | **High** |
| Local order not updated with serverId | **High** |
| cashierId "current_user" | **High** |
| No background sync worker | **Medium** |
| No conflict resolution on pull | **Medium** |
| Order number format mismatch | **Medium** |
| Retry/backoff not implemented | **Medium** |
| No deviceId in payload | **Low** |
| Drizzle vs WatermelonDB | **Low** |

---

## Technical Risk Explanation

- **Concurrency**: Single-threaded JS; no explicit locking. Multiple rapid sync triggers could process the same queue with overlapping runs (e.g. two `syncAll()` in flight). Queue state is updated per item, so partial double-processing is possible.
- **Durability**: SQLite with default settings; no explicit `fsync` or WAL configuration. Device crash after write but before flush can theoretically lose the last operation (mitigated by SQLite’s default durability for single writes).
- **Crash mid-sync**: Item set to `syncing`, then crash → item never retried (pending fix: treat stale `syncing` as `pending`).
- **Network flapping**: Rapid offline/online can trigger multiple `syncAll()`; with no idempotency, duplicate pushes are possible.
- **Payment confirmed but sync fails**: Order is committed locally and receipt shown; if sync never succeeds, server has no record. No reconciliation path (e.g. webhook or manual export) is implemented.

---

## Real-World Comparison

- **Square / Shopify POS**: Use dedicated sync endpoints, idempotency keys, and often operation-based or CRDT-style reconciliation; offline orders are mapped to server entities and inventory is reserved or reconciled with conflict handling.
- **Loyverse**: Offline queue with server-side deduplication and incremental sync; inventory and orders are reconciled with clear conflict rules.
- **Best practice**: Write-ahead log or single atomic “order + queue entry” transaction; background sync worker with exponential backoff; idempotency keys for all mutating sync operations; local inventory updated optimistically and reconciled on pull.

---

## Impact if Unresolved

- **Offline orders never sync**: Merchants in low-connectivity regions will lose sales data on the server and have incorrect central reporting and inventory.
- **Duplicate orders and stock**: Retries without idempotency can create duplicate orders and double decrement of inventory, leading to negative stock and wrong financials.
- **Stale local stock**: Cashiers may sell out-of-stock items or believe best sellers are out of stock, damaging trust and operations.
- **Orphaned orders**: Orders created but not enqueued (e.g. crash) remain only on device with no path to server.
- **Support and compliance**: No single source of truth for order numbers; reconciliation and audits are difficult.

---

## Edge Cases (Conceptual)

| Scenario | Expected | Current behavior |
|----------|----------|------------------|
| Device crash mid-transaction | Rollback or recoverable | No transaction; partial state possible (order without queue entry or vice versa). |
| Duplicate sync pushes | One order on server | No idempotency; duplicate orders and double stock deduction. |
| Partial sync failure (e.g. 2nd of 5 orders fails) | 1st committed, 2nd retried, 3–5 not sent yet | 1st marked completed; 2nd marked failed; 3–5 remain pending. Next run retries 2–5; 1st not retried. If 1st response was lost, 1st is retried → duplicate. |
| Inventory sold offline on 2 devices | Serialize or reconcile | Each device has local stock; both can sell same last unit. On sync, two order pushes; server runs sequentially. Second order can get “Insufficient stock” or, with no check, go negative. |
| Payment confirmed, sync fails | Order eventually on server or flagged | Order stays pending; no automatic retry policy or admin reconciliation. |
| App killed before local commit | No order | Possible if kill happens between in-memory steps and SQLite commit; generally SQLite commit is quick so order usually exists. |
| Network flapping | Stable sync, no duplicates | Multiple sync triggers; risk of duplicate pushes without idempotency. |

---

*Audit scope: Mobile offline layer, local DB (Drizzle/SQLite), sync engine (syncService, syncStore), and order/checkout flow. No code was modified.*
