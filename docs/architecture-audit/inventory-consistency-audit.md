# Inventory Integrity & Consistency — Architecture Audit

## Executive Summary

**Server-side** order creation uses a **MongoDB transaction** and **atomic `$inc`** to decrement `stockQuantity` per order item, which is correct for a single request. The Product schema enforces `min: 0` for `stockQuantity`, but **MongoDB does not enforce schema constraints on the result of `$inc`** in the same way as on full document validation; concurrent requests that each pass the “available stock” check can both decrement and **negative stock is possible**. There is **no inventory reservation** (hold stock between add-to-cart and payment), **no rollback path** for failed payment after stock decrement (order is created in same transaction as decrement; no separate “confirm payment” step that could fail after), and **no dedicated inventory adjustment transaction log** as suggested by the blueprint. **Client-side**, local inventory is **not decremented** on offline checkout, so local stock is wrong until the next full pull. Manual stock updates use **direct set** (not delta), which can overwrite concurrent changes. **Severity: High** for multi-device and offline scenarios.

---

## Current Implementation Summary

### Server: Order Creation and Stock

- **OrderController.createOrder** (orderController.ts):
  - Starts a MongoDB session and `withTransaction`.
  - For each `item`: `Product.findOne({ _id: item.productId, storeId, isActive: true }).session(session)`.
  - If not found → throw “Product not found or inactive”.
  - If `product.stockQuantity < item.quantity` → throw “Insufficient stock”.
  - `Product.findByIdAndUpdate(item.productId, { $inc: { stockQuantity: -item.quantity } }, { session })`.
  - Then creates Order, updates Customer if present; all in same transaction.
- **Atomicity**: Order + all product decrements + customer update are in one transaction; rollback on any failure.
- **Concurrency**: Two concurrent requests for the same product (e.g. last 1 unit): both can read `stockQuantity === 1`, both pass the check, both run `$inc -1`. One update wins, the other can result in 0 or -1 depending on order of execution. MongoDB does not apply schema `min: 0` to the result of `$inc` in the same way as validate on insert/update of full document; negative is possible.

### Server: Cancel Order (Stock Restore)

- **OrderController.cancelOrder**: Uses a transaction; for each order item, `Product.findByIdAndUpdate(..., { $inc: { stockQuantity: item.quantity } }, { session })`; then sets order status to `cancelled`; updates customer stats. **No** payment reversal or refund recording; stock and payments can diverge if payment was already captured.

### Server: Manual Stock Update

- **ProductController.updateStock** (productController.ts): `Product.findOneAndUpdate({ _id, storeId, isActive: true }, { stockQuantity }, { new: true })`. Rejects `stockQuantity < 0` in application code. This is a **full replace** of `stockQuantity`, not a delta. No `syncVersion` or conditional update; last write overwrites. Concurrent order creation and manual stock update can interleave: e.g. admin sets stock to 10 while an order is being created that decrements 5 → final value can be 10 (if update runs after decrement) or 5 (if decrement runs after update), with no merge logic.

### Server: Product Model

- **stockQuantity**: Number, required, `min: 0`, default 0.
- **syncVersion**: Incremented in `pre('save')` on non-new documents. Not used in order or stock endpoints for optimistic locking.

### Client: Local Inventory

- **createOrder** (db-helpers, orderStore): Inserts order only. **No** update to `products.stock_quantity` in the local DB. Offline sales do not reduce local stock.
- **Sync pull**: `updateLocalProducts` overwrites local product rows (including `stockQuantity`) by server response. So after sync, local stock reflects server at the time of GET /api/products — but between offline sale and sync, local stock is **stale high** (never decremented).
- **productStore.updateStock**: Calls `dbHelpers.updateProduct(id, { stockQuantity })` and can add a sync queue item for the product update. No atomic “order + product decrement” in local DB.

---

## Identified Weaknesses

### Critical

1. **Local inventory not updated on offline sale**  
   Creating an order offline does not decrement local `stock_quantity`. Cashiers see incorrect stock until next successful pull; multiple offline sales can make the gap large. Risk of selling more than physically available and of confusion when sync finally runs (server may reject if server stock is already 0).

2. **Negative stock possible under concurrent orders**  
   Two requests (e.g. two devices or one retry) that each sell the last N units: both pass the “available” check, both issue `$inc -N`. No row-level or document-level optimistic lock (e.g. “update only if stockQuantity >= N”). Result can be negative stock. Schema `min: 0` does not prevent this when using `$inc`.

### High

3. **No inventory reservation**  
   Blueprint and many POS systems reserve stock (e.g. when item is added to cart or when order is “pending payment”). Current flow: stock is decremented only when order is created (completed). No hold/release; under high concurrency, “available” can change between cart and checkout.

4. **Manual stock update is overwrite, not delta**  
   updateStock sets `stockQuantity` to the provided value. No “adjust by +X / -X” with reason code. Concurrent order decrements and manual updates can overwrite each other; no transaction log of adjustments for audit or reconciliation.

5. **No rollback for “payment failed after order created”**  
   Current design creates order and decrements stock in one transaction. If the flow were split (e.g. “reserve” then “confirm payment”), a failed payment would need explicit rollback. As implemented, there is no separate payment confirmation step that runs after order save, so no extra rollback path — but also no reservation that could be released on payment failure.

6. **Cancel order restores stock but not payment**  
   cancelOrder correctly restores stock in a transaction. It does not integrate with payment gateway (refund) or record a refund in a payments ledger. Financial and inventory can diverge.

### Medium

7. **No inventory adjustment transaction log**  
   Blueprint mentions “quantity adjustments with transaction log.” Backend has no dedicated InventoryAdjustment or StockMovement collection; order-driven changes are implicit in order items. Manual adjustments are a single field update with optional `reason` in body but not necessarily stored in an audit table.

8. **Pull overwrites local stock without merge**  
   On sync pull, local product rows are fully overwritten by server data. Any local-only adjustments (if they existed) would be lost. Currently local is not decremented on sale, so the main issue is server winning; but there is no “merge” or “adjustment log” model.

9. **Multi-device: two devices sell “last unit”**  
   Device A and B both have local stock 1. Both sell 1 offline. On sync, A pushes first → server goes 1 → 0. B pushes → server either rejects “Insufficient stock” or, if validation is bypassed or timing allows, goes to -1. No reservation or server-side “claim last unit” lock.

### Low

10. **syncVersion not used for stock**  
    Product has syncVersion but it is not used in updateStock or in order creation to enforce optimistic concurrency. Cannot implement “update stock only if version unchanged.”

---

## Severity Rating

| Weakness | Severity |
|----------|----------|
| Local inventory not updated on offline sale | **Critical** |
| Negative stock possible (concurrent/duplicate) | **Critical** |
| No inventory reservation | **High** |
| Manual stock overwrite, no delta/adjustment log | **High** |
| No payment rollback path (N/A for current flow) | **High** (for future split flow) |
| Cancel restores stock but not payment | **High** |
| No adjustment transaction log | **Medium** |
| Pull overwrites without merge | **Medium** |
| Two devices sell last unit | **Medium** |
| syncVersion not used for stock | **Low** |

---

## Technical Risk Explanation

- **MongoDB $inc and min**: Mongoose schema `min: 0` is applied on full-document validate (e.g. `doc.save()`). `findByIdAndUpdate` with `$inc` does not re-validate the full document by default, so the result of `current - quantity` can be negative if two updates interleave.
- **Fix for negative stock**: Use `findOneAndUpdate` with a condition, e.g. `{ stockQuantity: { $gte: item.quantity } }` and `$inc: { stockQuantity: -item.quantity }`, and check `modifiedCount` or return value; if no document updated, throw “Insufficient stock” and abort transaction. Not currently implemented.
- **Enterprise POS**: Often use reserved quantity (available = onHand - reserved), or pessimistic locking (select for update), or atomic “decrement only if >= N” as above.

---

## Real-World Comparison

- **Square / Shopify**: Inventory reservation or hold; atomic “decrement if sufficient”; reconciliation and adjustment history.
- **Loyverse**: Stock levels with sync and conflict rules; adjustment reasons and audit.
- **Best practice**: Atomic conditional decrement; reservation model for high contention; inventory adjustment log (productId, delta, reason, orderId, userId, timestamp); payment reversal integrated with cancel/refund.

---

## Impact if Unresolved

- **Negative stock** → incorrect reports, impossible picks, and user distrust.
- **Stale local stock** → oversell or refusal to sell when stock exists; poor UX in offline-heavy environments.
- **No reservation** → oversell under concurrency when many devices or tabs sell the same SKU.
- **No adjustment log** → hard to audit and reconcile discrepancies; no clear “who changed what when.”

---

## Atomicity Summary

| Operation | Atomic? | Notes |
|-----------|--------|--------|
| Order create + stock decrement (server) | Yes | Single MongoDB transaction. |
| Order cancel + stock restore (server) | Yes | Single transaction. |
| Manual updateStock (server) | Single doc | No transaction with order; overwrite. |
| Offline order create (client) | Order only | No local stock decrement. |
| Sync pull merge (client) | Per row | Full overwrite by server; no merge. |

---

*Audit scope: Inventory update paths (order create, cancel, manual update), server and client behavior, and consistency under concurrency and offline. No code was modified.*
