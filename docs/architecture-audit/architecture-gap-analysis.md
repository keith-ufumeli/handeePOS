# Architecture Gap Analysis — Blueprint vs Implementation

**Note:** Sections 1–10 reflect the original blueprint comparison. **Post-remediation status** (below) describes gaps that were later addressed by the mobile-offline remediation and subsequent architecture-gap fixes.

## Executive Summary

This document cross-checks the **current implementation** against the **handeePOS Technical Blueprint** and the **README**. Several **intended design elements are missing or implemented differently**: no dedicated sync API, no WatermelonDB (Drizzle + SQLite used instead), no incremental pull or lastSync, no conflict resolution using syncVersion, no local inventory update on offline sale, and no ID mapping for offline orders (so they fail to sync). The blueprint’s conflict rules (Orders always sync, Products server wins, Inventory with transaction log) are only partially reflected: orders are intended to sync but currently fail due to productId; products are server-wins on pull but with full overwrite and no version check; inventory has no transaction log. **Multi-store isolation** is implemented (storeId on queries). **Sync flow** (detect connectivity → pull → push → resolve conflicts → update timestamp) exists in spirit on the client but without proper push semantics (no batch, no idempotency) and without real conflict resolution.

---

## 1. Offline Mode & Data Synchronization Strategy

### Blueprint

- **Local storage**: “Use WatermelonDB or Realm” (recommendation: WatermelonDB for React Native).
- **Store**: Products catalog, pending transactions, customer info.
- **Queue**: All mutations (create/update/delete) with timestamps.
- **Sync flow**:  
  1. Device detects internet.  
  2. Check server timestamp vs last sync timestamp.  
  3. Pull changes from server (products, inventory updates).  
  4. Push local changes (orders, inventory adjustments).  
  5. Resolve conflicts (last write wins or custom).  
  6. Update local sync timestamp.

### Implementation

| Aspect | Blueprint | Implementation | Gap |
|--------|-----------|-----------------|-----|
| Local DB | WatermelonDB (or Realm) | Drizzle + expo-sqlite (SQLite) | **Different technology**; no WatermelonDB. |
| Queue mutations | All mutations with timestamps | sync_queue with operation, collection, documentId, data, timestamp, status | **Aligned**: queue exists with timestamps. |
| Detect connectivity | Step 1 | NetInfo + setOnlineStatus → syncAll | **Aligned**. |
| Server vs last sync timestamp | Step 2 | Not implemented; no server timestamp exchange, no “check” step | **Gap**: no comparison with server time. |
| Pull | Products, inventory updates | GET /api/products, GET /api/products/categories; no lastSync/cursor | **Partial**: pull exists but **full** pull only; no incremental or “inventory updates” as a separate concept. |
| Push | Orders, inventory adjustments | Per-item REST: POST /api/orders, product/category CRUD | **Partial**: push exists but **no dedicated /api/sync/push**; no batch, no idempotency. |
| Resolve conflicts | Last write wins or custom | Pull overwrites local by serverId; no syncVersion or timestamp comparison | **Partial**: server wins on pull; no explicit “conflict resolution” with versions. |
| Update local sync timestamp | Step 6 | lastSyncTime in syncStore (from completed queue items); no server-acknowledged “last sync” | **Partial**: local notion only; no server-stored sync cursor. |

**Verdict**: Sync flow is partially implemented; missing server timestamp check, incremental pull, dedicated push API, and proper conflict resolution (e.g. syncVersion). Local DB choice differs from blueprint.

---

## 2. Conflict Resolution Rules (Blueprint)

### Blueprint

- **Orders**: Never conflict (always sync to server).
- **Products**: Server wins (pull updates).
- **Inventory**: Use quantity adjustments with transaction log.
- **Settings**: Server wins, notify user of changes.

### Implementation

| Entity | Blueprint rule | Implementation | Gap |
|--------|----------------|----------------|-----|
| Orders | Always sync to server | Client pushes via POST /api/orders; **sync fails** because items use local productIds. Server does not accept; orders do not reliably sync | **Critical**: “always sync” is broken by ID mismatch. |
| Products | Server wins (pull) | Pull overwrites local products by serverId. No version check; full overwrite | **Aligned** in outcome; no explicit “conflict” detection (e.g. syncVersion). |
| Inventory | Adjustments with transaction log | No InventoryAdjustment / StockMovement collection. Order-driven change is implicit in orders; manual update is single field. No adjustment log | **Gap**: no transaction log for adjustments. |
| Settings | Server wins, notify | Settings endpoints exist; no explicit “notify user of changes” in sync flow | **Partial**: server is source of truth; notification on change not clearly implemented in sync. |

**Verdict**: Orders “always sync” is not achieved. Products are server-wins. Inventory has no adjustment transaction log.

---

## 3. Sync API Endpoints

### Blueprint / README

- **POST /api/sync/pull** — Pull server changes.
- **POST /api/sync/push** — Push local changes.
- **GET /api/sync/status** — Check sync status.

### Implementation

- **app.ts** mounts: index, auth, products, orders, customers, reports, settings. **No sync router.**
- Index route lists `sync: '/api/sync'` in JSON; that path is not mounted.
- Mobile uses GET /api/products, GET /api/products/categories for “pull” and POST /api/orders (and product/category CRUD) for “push.”

**Verdict**: **All three sync endpoints are missing.** Sync is implemented via existing REST only.

---

## 4. Order and Sync Queue Data Model

### Blueprint (Orders Collection)

- orderNumber, storeId, cashierId, customerId, items, totals, payments, status, customNote, createdAt, completedAt, **syncStatus**, **deviceId**.

### Implementation

- **Backend Order**: Has orderNumber (server-generated), syncStatus, deviceId (optional). **Aligned.**
- **Backend** does not set syncStatus from client on create; orderNumber is always server-generated.
- **Mobile**: Local order has orderNumber (client: `ORD-${Date.now()}`), syncStatus, no serverId stored after sync. Sync queue stores order payload with local productIds. **Gap**: local orderNumber format differs; no serverId on local order after push; items use local IDs so push fails.

### Blueprint (Sync Queue Collection)

- deviceId, operation, collection, documentId, data, timestamp, status, retryCount, error.

### Implementation

- **Mobile sync_queue**: id, operation, collection, document_id, data, status, retry_count, error_message, timestamp. **No deviceId** in schema. **Largely aligned** otherwise.

---

## 5. Offline Sale Example (Blueprint)

### Blueprint

“When a cashier makes a sale offline, the order is stored locally with syncStatus: 'pending'. Once online, the sync engine sends all pending orders to the server in chronological order. If inventory was updated on the server while offline, the app pulls the latest inventory and adjusts local stock accordingly.”

### Implementation

- Order is stored locally with syncStatus pending; queue item is created. **Aligned.**
- Sync sends pending orders via POST /api/orders. **But** payload has local productIds → server returns “Product not found” → **orders do not sync.**
- After push attempt, pull runs (GET products/categories) and overwrites local products. So “pulls latest inventory” **does** happen, but **local stock was never decremented** for the offline sale, so until that pull, local stock is wrong; after pull, server stock does not include the offline order (because push failed). **Gap**: offline sale neither syncs nor correctly updates local inventory.

**Verdict**: Intended flow is only partially implemented; critical path (order sync + local inventory truth) is broken.

---

## 6. Order Number and Device Identification

### Blueprint

- orderNumber: e.g. "ORD-20250101-001".
- deviceId for offline tracking.

### Implementation

- **Server**: orderNumber = `ORD-YYYYMMDD-NNN` (date + sequence). **Matches** blueprint format.
- **Mobile**: local orderNumber = `ORD-${Date.now()}` (timestamp). **Different**; not same format. deviceId is optional on server; mobile does not consistently send deviceId in order payload.

**Verdict**: Order number format on client diverges; deviceId underused.

---

## 7. Multi-Store Isolation

### Blueprint

- Data isolated by storeId; queries always filtered by storeId.

### Implementation

- Backend controllers (orders, products, customers, etc.) use `req.user?.storeId` and filter by storeId. **Aligned.**

**Verdict**: **No gap**; multi-store isolation is implemented.

---

## 8. Edge Case Handling (Blueprint)

### Blueprint (Sales Module)

- “Offline mode: Queue transaction for sync.”
- “Failed payment: Rollback inventory, mark order as 'pending'.”

### Implementation

- Offline: order is queued. **Aligned** (except sync fails due to productId).
- Failed payment: Current flow creates order and decrements stock in one transaction; there is no separate “payment confirm” step that can fail after. So no extra “rollback inventory, mark pending” path. **Partial**: no split between “reserve/order” and “confirm payment.”

---

## 9. Summary Table: Blueprint vs Implementation

| Area | Blueprint | Implementation | Deviation |
|------|-----------|----------------|-----------|
| Local DB | WatermelonDB | Drizzle + SQLite | **Different** |
| Sync API | /api/sync/push, pull, status | Not implemented | **Missing** |
| Pull | With lastSync / delta | Full GET only | **Incremental missing** |
| Push | Batch to sync endpoint | Per-entity REST | **No batch, no idempotency** |
| Orders always sync | Yes | Fails (productId) | **Broken** |
| Products server wins | Yes | Full overwrite on pull | **OK** |
| Inventory transaction log | Yes | No | **Missing** |
| Conflict resolution | Last write wins / custom | Implicit overwrite only | **No version-based** |
| syncVersion | In schema | Exists, unused | **Not used** |
| Local inventory on offline sale | Implied correct local state | Not decremented | **Gap** |
| Order number | ORD-YYYYMMDD-NNN | Server: yes; client: ORD-ts | **Client differs** |
| Multi-store | storeId isolation | Implemented | **OK** |

---

## 10. Architectural Gaps vs Best Practices

- **Write-ahead logging / single transaction for “order + enqueue”**: Not implemented; order and queue insert are separate.
- **Idempotency keys for push**: Not implemented; duplicate requests create duplicate orders.
- **Incremental pull (cursor / updatedAfter)**: Not implemented.
- **Server-side sync status or device tracking**: Not implemented.
- **Background sync worker**: Not implemented; sync on reconnect and manual only.
- **Optimistic concurrency (syncVersion)**: Schema present; not used in APIs.
- **Inventory reservation**: Not implemented.
- **Payment confirmation webhook / reconciliation**: Not implemented.

---

## Post-remediation status

The following gaps identified above were addressed by the **mobile-offline remediation** and (where noted) by the **architecture-gap fixes**:

| Gap | Status | How addressed |
|-----|--------|----------------|
| Orders "always sync" broken (productId) | **Fixed** | syncService maps local productId to serverId before POST /api/orders; local order updated with serverId and server orderNumber after successful push. |
| Local inventory not decremented on offline sale | **Fixed** | createOrderWithStockAndSyncQueue (and orderStore) decrement local stock when creating an order; stock validation before create. |
| No idempotency for push | **Fixed** | Backend order create accepts X-Idempotency-Key and caches response (24h TTL); mobile sends documentId as key on order push. |
| Order + enqueue not transactional | **Fixed** | createOrderWithStockAndSyncQueue runs order insert, stock decrements, and sync queue insert in one transaction (or same steps when driver has no transaction). |
| No serverId on local order after push | **Fixed** | updateOrderSyncResult called from syncService after successful order create; local order row gets serverId, orderNumber, syncStatus, lastSyncedAt. |
| deviceId not sent in order payload | **Fixed** | orderStore uses getOrCreateDeviceId() and includes deviceId in order and sync payload; backend receives req.body.deviceId. |
| cashierId "current_user" | **Fixed** | orderStore uses useAuthStore.getState().user?.userId ?? 'offline'. |
| Sync queue "syncing" never retried | **Fixed** | resetStaleSyncingItems() at start of syncAll(); items stuck in "syncing" >5 min reset to pending. |

**Remaining (addressed by architecture-gap fixes plan):** dedicated sync API, incremental pull (updatedAfter), syncVersion in product update, deviceId in sync_queue schema, inventory adjustment transaction log. See implementation for current state of those items.

---

*Audit scope: Comparison of implementation to handeePOS-technical-blueprint.md and README. No code was modified.*
