# MongoDB Import Guide

These CSV files are designed for importing data into MongoDB for the HandeePOS system.

## Prerequisites

1. Ensure you have MongoDB installed and running
2. Have your `storeId` ready (MongoDB ObjectId format: 24 hex characters)
3. Update the `storeId` values in both CSV files with your actual store ID

## Import Steps

### Step 1: Update Store ID

**Important:** Before importing, update the `storeId` in both CSV files with your actual store ID.

In `categories.csv` and `products.csv`, replace `68f9f9a4ec280ec966a51aba` with your actual store ID.

### Step 2: Import Categories

```bash
# Using mongoimport
mongoimport --uri="mongodb://localhost:27017/handeepos" \
  --collection=categories \
  --type=csv \
  --headerline \
  --file=categories.csv
```

Or using MongoDB Compass:
1. Open MongoDB Compass
2. Connect to your database
3. Select the `categories` collection
4. Click "Import Data" → "CSV"
5. Select `categories.csv`
6. Map fields and import

### Step 2: Get Category IDs

After importing categories, get the category IDs:

```javascript
// In MongoDB shell or Compass Query
db.categories.find(
  { storeId: ObjectId("YOUR_STORE_ID") }, 
  { _id: 1, name: 1 }
).forEach(cat => print(cat.name + ": " + cat._id));
```

### Step 3: Import Products

**Option A: Using categoryName (Recommended)**

1. Import `products.csv` (uses `categoryName` column)
2. Run the mapping script `import-products.js` to convert names to IDs:

```bash
# Update STORE_ID and DB_NAME in import-products.js first
mongo handeepos import-products.js
```

**Option B: Using categoryId placeholders**

1. Open `products-with-categoryids.csv`
2. Replace all placeholder values with actual category IDs from Step 2:
   - `REPLACE_WITH_ELECTRONICS_ID` → actual Electronics category `_id`
   - `REPLACE_WITH_FOOD_BEVERAGES_ID` → actual Food & Beverages category `_id`
   - `REPLACE_WITH_CLOTHING_ID` → actual Clothing category `_id`
   - `REPLACE_WITH_HOME_KITCHEN_ID` → actual Home & Kitchen category `_id`
   - `REPLACE_WITH_HEALTH_BEAUTY_ID` → actual Health & Beauty category `_id`
   - `REPLACE_WITH_OFFICE_SUPPLIES_ID` → actual Office Supplies category `_id`
3. Import the updated CSV:

```bash
mongoimport --uri="mongodb://localhost:27017/handeepos" \
  --collection=products \
  --type=csv \
  --headerline \
  --file=products-with-categoryids.csv
```

## Field Mappings

### Categories CSV
- `storeId`: MongoDB ObjectId (24 hex characters)
- `name`: Category name (required, unique per store)
- `description`: Optional description
- `isActive`: Boolean (true/false)

### Products CSV
- `storeId`: MongoDB ObjectId (24 hex characters)
- `name`: Product name (required)
- `sku`: Stock Keeping Unit (required, unique per store, uppercase)
- `barcode`: Barcode (optional, unique if provided)
- `categoryName`: Category name (used in products.csv - will be converted to categoryId)
- `categoryId`: MongoDB ObjectId referencing Category (used in products-with-categoryids.csv)
- `price`: Selling price (number, required)
- `cost`: Cost price (number, required)
- `taxRate`: Tax rate percentage (number, default: 0)
- `stockQuantity`: Current stock (number, default: 0)
- `lowStockThreshold`: Low stock alert threshold (number, default: 5)
- `unit`: Unit of measurement (string, default: 'pcs')
- `isActive`: Boolean (true/false, default: true)

## Field Mapping Verification

Run the verification script to check field compatibility:

```bash
node verify-mapping.js
```

Or see `FIELD_MAPPING.md` for detailed field mapping reference.

## Notes

- **Field Names**: CSV uses camelCase (matches backend model exactly)
- **storeId**: Backend adds `storeId` from JWT token. CSV `storeId` is for reference/filtering only
- **Auto-generated**: MongoDB auto-generates `_id`, `createdAt`, `updatedAt` fields
- **syncVersion**: Defaults to 1 for products (backend model)
- **Category References**: Must use valid MongoDB ObjectId format (24 hex characters)
- **Uniqueness**: Category names must be unique per store, SKUs must be unique per store
- **Barcodes**: Must be unique if provided (sparse index allows multiple nulls)

## Compatibility

✅ **CSV → MongoDB**: Direct import (camelCase matches backend model)
✅ **MongoDB → Backend API**: Direct read (camelCase matches)
✅ **Backend API → Frontend**: SyncService handles camelCase
✅ **Frontend → Local DB**: Converts to snake_case for SQLite
✅ **Local DB → Frontend UI**: Converts back to camelCase

See `FIELD_MAPPING.md` for complete field mapping reference.

