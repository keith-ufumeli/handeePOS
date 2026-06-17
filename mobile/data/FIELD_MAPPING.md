# Field Mapping Reference: CSV → Backend → Frontend

This document ensures field name compatibility across CSV imports, backend models, and frontend stores.

## Field Name Convention

- **CSV Files**: Use camelCase (matches backend model)
- **Backend API**: Returns camelCase
- **Backend Model**: Uses camelCase
- **Frontend SyncService**: Handles both camelCase and snake_case (for compatibility)
- **Frontend Local DB**: Stores snake_case (SQLite convention)

## Category Field Mapping

| CSV Field | Backend Model | Backend API Response | Frontend Local DB | Notes |
|-----------|---------------|---------------------|------------------|-------|
| `storeId` | `storeId` | `storeId` | N/A | ObjectId, from token |
| `name` | `name` | `name` | `name` | Required, unique per store |
| `description` | `description` | `description` | `description` | Optional |
| `isActive` | `isActive` | `isActive` | `is_active` | Boolean, default: true |

**Auto-generated fields** (not in CSV):
- `_id` - MongoDB ObjectId
- `createdAt` - Date
- `updatedAt` - Date

## Product Field Mapping

| CSV Field | Backend Model | Backend API Response | Frontend Local DB | Notes |
|-----------|---------------|---------------------|------------------|-------|
| `storeId` | `storeId` | `storeId` | N/A | ObjectId, from token |
| `name` | `name` | `name` | `name` | Required |
| `sku` | `sku` | `sku` | `sku` | Required, unique per store, uppercase |
| `barcode` | `barcode` | `barcode` | `barcode` | Optional, unique if provided |
| `categoryName` | N/A | N/A | N/A | Used in products.csv, converted to categoryId |
| `categoryId` | `categoryId` | `categoryId` | `category_id` | ObjectId, references Category |
| `price` | `price` | `price` | `price` | Required, number |
| `cost` | `cost` | `cost` | `cost` | Required, number |
| `taxRate` | `taxRate` | `taxRate` | `tax_rate` | Number, default: 0 |
| `stockQuantity` | `stockQuantity` | `stockQuantity` | `stock_quantity` | Number, default: 0 |
| `lowStockThreshold` | `lowStockThreshold` | `lowStockThreshold` | `low_stock_threshold` | Number, default: 5 |
| `unit` | `unit` | `unit` | `unit` | String, default: "pcs" |
| `isActive` | `isActive` | `isActive` | `is_active` | Boolean, default: true |

**Auto-generated fields** (not in CSV):
- `_id` - MongoDB ObjectId
- `syncVersion` - Number, default: 1
- `createdAt` - Date
- `updatedAt` - Date

## Data Flow Verification

### 1. CSV Import → MongoDB
✅ **Compatible**: CSV uses camelCase, MongoDB stores as-is
- MongoDB will accept camelCase field names directly
- No transformation needed during import

### 2. MongoDB → Backend API
✅ **Compatible**: Backend model uses camelCase
- Backend reads from MongoDB with camelCase fields
- API responses return camelCase fields

### 3. Backend API → Frontend SyncService
✅ **Compatible**: SyncService handles camelCase
```typescript
// syncService.ts handles both formats:
categoryId: serverProduct.categoryId || serverProduct.category_id
stockQuantity: serverProduct.stockQuantity || serverProduct.stock_quantity
```

### 4. Frontend SyncService → Local DB
✅ **Compatible**: SyncService converts to snake_case
```typescript
// Converts camelCase → snake_case for SQLite
category_id: productData.categoryId
stock_quantity: productData.stockQuantity
```

### 5. Local DB → Frontend UI
✅ **Compatible**: db-helpers convert back to camelCase
```typescript
// productFromDb() converts snake_case → camelCase
categoryId: row.category_id
stockQuantity: row.stock_quantity
```

## Import Process

1. **Import Categories** (`categories.csv`)
   - Fields: `storeId`, `name`, `description`, `isActive`
   - MongoDB stores with camelCase field names
   - Backend API can read directly

2. **Import Products** (`products.csv` with `categoryName`)
   - Fields: `storeId`, `name`, `sku`, `barcode`, `categoryName`, `price`, `cost`, `taxRate`, `stockQuantity`, `lowStockThreshold`, `unit`, `isActive`
   - Run `import-script.js` to convert `categoryName` → `categoryId`
   - MongoDB stores with camelCase field names
   - Backend API can read directly

3. **Alternative: Import Products** (`products-with-categoryids.csv`)
   - Fields: `storeId`, `name`, `sku`, `barcode`, `categoryId`, `price`, `cost`, `taxRate`, `stockQuantity`, `lowStockThreshold`, `unit`, `isActive`
   - Requires manual replacement of placeholder category IDs
   - MongoDB stores with camelCase field names
   - Backend API can read directly

## Verification Checklist

- [x] CSV field names match backend model (camelCase)
- [x] Backend API returns camelCase
- [x] Frontend syncService handles camelCase
- [x] Frontend converts to snake_case for local DB
- [x] Frontend converts back to camelCase for UI
- [x] Category references work correctly
- [x] All required fields are present in CSV
- [x] Optional fields have defaults in backend model

## Notes

1. **storeId**: Not included in CSV import - backend adds it from JWT token. CSV `storeId` is for reference only.
2. **categoryId**: Must be valid MongoDB ObjectId. Use `import-script.js` to convert from `categoryName`.
3. **Field Types**: MongoDB will auto-convert strings to numbers/booleans based on backend schema validation.
4. **Timestamps**: MongoDB will auto-generate `createdAt` and `updatedAt` if not provided.

