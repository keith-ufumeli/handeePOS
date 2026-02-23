# Backend Sync & API — Architecture Audit

## Executive Summary

The backend **does not expose dedicated sync endpoints** (`/api/sync/push`, `/api/sync/pull`, `/api/sync/status`). The technical blueprint and README reference them, but **app.ts mounts no sync routes**. The mobile app implements “sync” by calling standard REST APIs: **POST /api/orders**, **GET /api/products**, **GET /api/products/categories**, and product/category create/update/delete. Order creation is **transactional** (MongoDB session) and uses **atomic `$inc`** for inventory deduction, which is correct. However, **order creation is not idempotent**: duplicate requests create duplicate orders and double inventory deduction. **syncVersion** exists on the Product model but is **not used** in any API for conflict detection or last-write-wins. There is **no server-side sync status**, **no cursor or lastSync** for pull, and **no device-scoped or idempotency-key handling**. **Severity: High** for production offline-first use.

**Note:** This audit was written **before** the architecture-gap remediation. See the **Post-remediation status** section below for what has since been implemented (dedicated sync API, idempotency, syncVersion, incremental pull, sync status).

---

## Current Implementation Summary

### API Structure

- **Mounted routes** (app.ts): `/api` (index), `/api/auth`, `/api/products`, `/api/orders`, `/api/customers`, `/api/reports`, `/api/settings`. **No `/api/sync` router.**
- **Index route** lists `sync: '/api/sync'` in endpoint info, but that path is not implemented.
- **Post-remediation:** Sync routes are mounted at `/api/sync` (GET /status, POST /pull, POST /push).

### Order Creation (POST /api/orders)

- **OrderController.createOrder**: Uses `mongoose.startSession()` and `session.withTransaction()`.
- **Flow**: Validates `storeId`, `cashierId`, `items`; for each item finds product by `_id: item.productId`, checks `stockQuantity >= item.quantity`, then `Product.findByIdAndUpdate(..., { $inc: { stockQuantity: -item.quantity } }, { session })`; creates Order with `orderData` (no `orderNumber` in body — generated in pre-save); updates Customer if `customerId`; returns populated order.
- **Order number**: Generated in `OrderSchema.pre('save')`: pattern `ORD-YYYYMMDD-NNN` (date + sequence per day). Client-supplied `orderNumber` in body is **not** used; server always overwrites.
- **Idempotency**: None. Same body sent twice → two orders, inventory decremented twice.
- **Post-remediation:** Idempotency: `X-Idempotency-Key` header supported; cached response returned on duplicate key.

### Product & Category APIs

- **Post-remediation:** GET /api/products and GET /api/products/categories accept optional `updatedAfter` for incremental pull and return `serverTimestamp` when used; product update supports optional `syncVersion` with 409 on conflict.
- **GET /api/products**: List with filters (search, category, lowStock), pagination, sort. No `updatedAfter` or `lastSync` query params.
- **GET /api/products/categories**: List categories. No incremental params.
- **POST/PUT/DELETE** products and categories: Standard CRUD. No `syncVersion` check; no conditional update (e.g. “update only if syncVersion matches”).

### Product Model

- **syncVersion**: Number, default 1; incremented in `pre('save')` on modify (not on create). Not used in controllers for conflict resolution.
- **stockQuantity**: Schema `min: 0`; updates via `$inc` in order flow can still result in negative if logic error or duplicate request (e.g. two concurrent requests each decrement 5 when only 5 in stock).

### Order Model

- **orderNumber**: Unique, required; server-generated.
- **syncStatus**: Enum `synced | pending | failed`; not enforced or set by backend on create (client could send it; pre-save doesn’t set it from request).
- **deviceId**: Optional; not required. Mobile does not consistently send it.

---

## Identified Weaknesses

### Critical

1. **No dedicated sync API**  
   Blueprint and docs describe `POST /api/sync/push`, `POST /api/sync/pull`, `GET /api/sync/status`. These do not exist. Mobile uses standard REST; server has no single place to enforce sync semantics (idempotency, batching, versioning).

2. **Order creation not idempotent**  
   Duplicate POST /api/orders (e.g. mobile retry after timeout) creates duplicate orders and double inventory deduction. No idempotency key, no “create or return existing” by client token.

### High

3. **syncVersion unused**  
   Product has `syncVersion` and it is incremented on save, but no endpoint checks it. Pull/update cannot implement “update only if my version is still current” or last-write-wins with version comparison. Conflict resolution is implicit (full overwrite on mobile pull).

4. **No incremental pull**  
   GET /api/products and GET /api/products/categories return full list (with pagination). No `lastSync`, `updatedAfter`, or cursor. Clients must full-scan every sync; inefficient and no true delta sync.

5. **No server-side sync status or device tracking**  
   No store for “last successful sync per device” or “pending operations per device.” Cannot detect or resolve conflicting pushes from multiple devices without custom logic elsewhere.

6. **Order items require server product IDs**  
   Backend expects `item.productId` to be a valid MongoDB ObjectId for a product in the same store. Mobile sends local IDs when syncing offline orders → 400/404 and “Product not found or inactive.” Backend is correct by contract; the gap is client sending wrong IDs and server having no alternate path (e.g. accept client order id + mapping or server-side mapping).

### Medium

7. **Negative stock possible under duplicate or bug**  
   Schema says `min: 0` for stockQuantity; `$inc` does not re-check the constraint in the same update. Two concurrent order requests each decrementing the last 1 unit can both succeed → stock -2 unless application logic prevents it (e.g. check in transaction). Current code checks then decrements in one transaction, so single-request duplicate (same order sent twice) is the main risk.

8. **cancelOrder restores stock but no refund/payment reversal**  
   cancelOrder uses a transaction and `$inc` to restore stock. No payment gateway reversal or refund record; financial and inventory can diverge if payment was already captured.

9. **No batch order endpoint**  
   Sync push from mobile sends one order per request. No POST /api/orders/batch to accept multiple orders in one transaction with single idempotency scope.

### Low

10. **deviceId optional and not used for dedup**  
    Order has optional deviceId; not used for idempotency or conflict resolution.

11. **Order pre-save always generates orderNumber**  
    Request body orderNumber is ignored. Fine for server-authoritative; but combined with mobile using its own format locally, two different numbers exist for the same logical order.

---

## Severity Rating

| Weakness | Severity |
|----------|----------|
| No dedicated sync API | **Critical** |
| Order creation not idempotent | **Critical** |
| syncVersion unused | **High** |
| No incremental pull | **High** |
| No server sync status / device tracking | **High** |
| Order items require server IDs (contract) | **High** |
| Negative stock under duplicate request | **Medium** |
| cancelOrder no payment reversal | **Medium** |
| No batch order endpoint | **Medium** |
| deviceId not used for dedup | **Low** |
| orderNumber server-only | **Low** |

---

## Technical Risk Explanation

- **Race conditions**: Two devices push orders that each sell the “last” unit of the same product. Both pass the availability check in their respective requests; both decrement. One will see 0, the other -1 (or both -1 if timing allows). Without optimistic locking or reservation, inventory can go negative.
- **Idempotency**: Without a key, any retry (timeout, network error, client crash after send) can duplicate the operation. Production POS systems typically use idempotency keys (e.g. client-generated UUID per “logical” order) and return 200 with same body when key is repeated.
- **Atomicity**: Order creation is atomic (transaction). If the transaction rolls back, no order and no stock change. Good. Partial failure (e.g. customer update fails) rolls back entire transaction.

---

## Real-World Comparison

- **Square / Stripe**: Idempotency keys on all mutating requests; sync or webhook reconciliation for payments.
- **Loyverse / Shopify**: Dedicated sync or bulk endpoints; version or timestamp for incremental pull; conflict resolution (e.g. server wins for catalog, merge for inventory adjustments).
- **Best practice**: Implement `/api/sync/push` (batch of operations with client ids/idempotency keys), `/api/sync/pull` (cursor or `updatedAfter`), and optionally `/api/sync/status`; use syncVersion or timestamp for conditional updates and last-write-wins.

---

## Impact if Unresolved

- **Duplicate orders and inventory errors** when mobile or proxy retries; financial and stock reports wrong.
- **Offline orders rejected** when client sends local product IDs; no way to “fix” from server only without client sending server IDs.
- **Scale and performance** limits when all clients do full product/category pull every sync.
- **Multi-device conflicts** not detectable or resolvable in a standardized way.

---

## Sync Endpoint Gap Summary

| Blueprint / Docs | Implemented | Notes |
|------------------|-------------|--------|
| POST /api/sync/push | Yes | Implemented in architecture-gap remediation; mobile may still use direct REST or switch to sync endpoints. |
| POST /api/sync/pull | Yes | Implemented in architecture-gap remediation; mobile may still use direct REST or switch to sync endpoints. |
| GET /api/sync/status | Yes | Implemented in architecture-gap remediation. |

---

## Post-remediation status

The following were implemented in the architecture-gap remediation and are now in place:

- **Dedicated sync API:** Implemented. Router at `/api/sync`; GET `/api/sync/status`, POST `/api/sync/pull`, POST `/api/sync/push`. See [backend/src/routes/sync.ts](backend/src/routes/sync.ts) and [backend/src/controllers/syncController.ts](backend/src/controllers/syncController.ts).
- **Order idempotency:** Implemented. `X-Idempotency-Key` header; in-memory cache with TTL; repeat key returns 200 and cached response. See [backend/src/controllers/orderController.ts](backend/src/controllers/orderController.ts).
- **syncVersion:** Implemented. Product update accepts optional `syncVersion`; 409 if mismatch; response includes new syncVersion.
- **Incremental pull:** Implemented. GET `/api/products` and GET `/api/products/categories` accept `updatedAfter`; return `serverTimestamp` when used. POST `/api/sync/pull` accepts `updatedAfter`/`lastSync` and optional `entityTypes`, returns single payload with `serverTimestamp`.
- **Sync status:** GET `/api/sync/status` returns `serverTimestamp` and message.
- **Order items / server IDs:** Backend contract unchanged; mobile maps local to server IDs before sync (client-side fix).
- **Batch push:** POST `/api/sync/push` accepts batch operations (including multiple orders) with per-operation idempotency.

---

*Audit scope: Backend API design, order and product controllers, Order/Product models, and sync-related behavior. No code was modified.*
