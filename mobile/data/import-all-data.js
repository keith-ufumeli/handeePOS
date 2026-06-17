/**
 * Complete Data Import Script for MongoDB (mongosh compatible)
 * 
 * This script imports categories and products data directly into MongoDB
 * without requiring mongoimport.
 * 
 * Usage in mongosh:
 *   use('handeepos')
 *   load('mobile/data/import-all-data.js')
 * 
 * Or from command line:
 *   mongosh "your-connection-string" --file mobile/data/import-all-data.js
 */

/* global ObjectId, db */

// ===== CONFIGURATION =====
const STORE_ID = '68f9f9a4ec280ec966a51aba'; // Update with your store ID
const DB_NAME = 'test'; // Update with your database name
// ==========================

// Check if db is available
if (typeof db === 'undefined') {
  print('ERROR: This script must be run in MongoDB shell (mongosh)');
  print('Usage: mongosh "connection-string" --file import-all-data.js');
  // @ts-ignore
  // eslint-disable-next-line no-undef
  quit(1);
}

const testDb = db.getSiblingDB(DB_NAME);

print('=== MongoDB Data Import Script ===\n');
print(`Database: ${DB_NAME}`);
print(`Store ID: ${STORE_ID}\n`);

// Helper function to convert string to ObjectId
function toObjectId(id) {
  if (typeof ObjectId === 'function') {
    return ObjectId(id);
  }
  return id;
}

const storeIdObjectId = toObjectId(STORE_ID);

// ===== STEP 1: Import Categories =====
print('Step 1: Importing Categories...\n');

const categories = [
  { storeId: storeIdObjectId, name: 'Electronics', description: 'Electronic devices and accessories', isActive: true },
  { storeId: storeIdObjectId, name: 'Food & Beverages', description: 'Food items and drinks', isActive: true },
  { storeId: storeIdObjectId, name: 'Clothing', description: 'Apparel and fashion items', isActive: true },
  { storeId: storeIdObjectId, name: 'Home & Kitchen', description: 'Home improvement and kitchen items', isActive: true },
  { storeId: storeIdObjectId, name: 'Health & Beauty', description: 'Health and beauty products', isActive: true },
  { storeId: storeIdObjectId, name: 'Books & Media', description: 'Books magazines and media', isActive: true },
  { storeId: storeIdObjectId, name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear', isActive: true },
  { storeId: storeIdObjectId, name: 'Toys & Games', description: 'Toys and games for all ages', isActive: true },
  { storeId: storeIdObjectId, name: 'Automotive', description: 'Car accessories and parts', isActive: true },
  { storeId: storeIdObjectId, name: 'Office Supplies', description: 'Office and stationery items', isActive: true }
];

// Check if categories already exist
const existingCategories = testDb.categories.countDocuments({ storeId: storeIdObjectId });

if (existingCategories > 0) {
  print(`⚠ Found ${existingCategories} existing categories. Skipping category import.`);
  print('   If you want to re-import, delete existing categories first.\n');
} else {
  let insertedCategories = 0;
  const categoryMap = {};
  
  categories.forEach(category => {
    try {
      // Check if category already exists by name
      const existing = testDb.categories.findOne({ 
        storeId: storeIdObjectId, 
        name: category.name 
      });
      
      if (existing) {
        categoryMap[category.name] = existing._id;
        print(`  ⚠ Category "${category.name}" already exists, using existing ID`);
      } else {
        const result = testDb.categories.insertOne(category);
        categoryMap[category.name] = result.insertedId;
        insertedCategories++;
        print(`  ✓ Inserted: "${category.name}"`);
      }
    } catch (error) {
      print(`  ✗ Error inserting "${category.name}": ${error.message}`);
    }
  });
  
  print(`\nCategories imported: ${insertedCategories}\n`);
}

// Build category map from existing categories
print('Building category mapping...');
const categoryMap = {};
testDb.categories.find({ storeId: storeIdObjectId }).forEach(cat => {
  categoryMap[cat.name] = cat._id;
  print(`  "${cat.name}" -> ${cat._id}`);
});

if (Object.keys(categoryMap).length === 0) {
  print('\nERROR: No categories found! Cannot import products.');
  // @ts-ignore
  // eslint-disable-next-line no-undef
  quit(1);
}

print(`\nTotal categories available: ${Object.keys(categoryMap).length}\n`);

// ===== STEP 2: Import Products =====
print('Step 2: Importing Products...\n');

const products = [
  { storeId: storeIdObjectId, name: 'Wireless Mouse', sku: 'ELEC-MOUSE-001', barcode: '1234567890123', categoryName: 'Electronics', price: 29.99, cost: 15.00, taxRate: 15, stockQuantity: 50, lowStockThreshold: 10, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'USB Keyboard', sku: 'ELEC-KEY-001', barcode: '1234567890124', categoryName: 'Electronics', price: 45.99, cost: 22.00, taxRate: 15, stockQuantity: 30, lowStockThreshold: 10, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'HDMI Cable 2m', sku: 'ELEC-CAB-001', barcode: '1234567890125', categoryName: 'Electronics', price: 12.99, cost: 5.00, taxRate: 15, stockQuantity: 100, lowStockThreshold: 20, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'USB Flash Drive 32GB', sku: 'ELEC-USB-001', barcode: '1234567890126', categoryName: 'Electronics', price: 19.99, cost: 8.00, taxRate: 15, stockQuantity: 75, lowStockThreshold: 15, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Wireless Headphones', sku: 'ELEC-AUD-001', barcode: '1234567890127', categoryName: 'Electronics', price: 79.99, cost: 40.00, taxRate: 15, stockQuantity: 25, lowStockThreshold: 5, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Coca Cola 500ml', sku: 'FOOD-BEV-001', barcode: '1234567890128', categoryName: 'Food & Beverages', price: 2.50, cost: 1.20, taxRate: 15, stockQuantity: 200, lowStockThreshold: 50, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Mineral Water 500ml', sku: 'FOOD-BEV-002', barcode: '1234567890129', categoryName: 'Food & Beverages', price: 1.50, cost: 0.60, taxRate: 15, stockQuantity: 300, lowStockThreshold: 100, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Chocolate Bar', sku: 'FOOD-SNK-001', barcode: '1234567890130', categoryName: 'Food & Beverages', price: 3.99, cost: 1.50, taxRate: 15, stockQuantity: 150, lowStockThreshold: 30, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Chips Pack 150g', sku: 'FOOD-SNK-002', barcode: '1234567890131', categoryName: 'Food & Beverages', price: 4.50, cost: 1.80, taxRate: 15, stockQuantity: 120, lowStockThreshold: 25, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Coffee Beans 500g', sku: 'FOOD-BEV-003', barcode: '1234567890132', categoryName: 'Food & Beverages', price: 24.99, cost: 12.00, taxRate: 15, stockQuantity: 40, lowStockThreshold: 10, unit: 'kg', isActive: true },
  { storeId: storeIdObjectId, name: 'Cotton T-Shirt', sku: 'CLO-TSH-001', barcode: '1234567890133', categoryName: 'Clothing', price: 19.99, cost: 8.00, taxRate: 15, stockQuantity: 60, lowStockThreshold: 15, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Jeans Blue', sku: 'CLO-JNS-001', barcode: '1234567890134', categoryName: 'Clothing', price: 49.99, cost: 20.00, taxRate: 15, stockQuantity: 40, lowStockThreshold: 10, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Running Shoes', sku: 'CLO-SHO-001', barcode: '1234567890135', categoryName: 'Clothing', price: 89.99, cost: 35.00, taxRate: 15, stockQuantity: 30, lowStockThreshold: 8, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Kitchen Knife Set', sku: 'HOM-KIT-001', barcode: '1234567890136', categoryName: 'Home & Kitchen', price: 39.99, cost: 15.00, taxRate: 15, stockQuantity: 20, lowStockThreshold: 5, unit: 'set', isActive: true },
  { storeId: storeIdObjectId, name: 'Dinner Plates Set 6pc', sku: 'HOM-KIT-002', barcode: '1234567890137', categoryName: 'Home & Kitchen', price: 29.99, cost: 12.00, taxRate: 15, stockQuantity: 35, lowStockThreshold: 10, unit: 'set', isActive: true },
  { storeId: storeIdObjectId, name: 'Shampoo 400ml', sku: 'BEA-CAR-001', barcode: '1234567890138', categoryName: 'Health & Beauty', price: 12.99, cost: 5.00, taxRate: 15, stockQuantity: 80, lowStockThreshold: 20, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Toothpaste 100g', sku: 'BEA-CAR-002', barcode: '1234567890139', categoryName: 'Health & Beauty', price: 4.99, cost: 1.80, taxRate: 15, stockQuantity: 150, lowStockThreshold: 30, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Notebook A4', sku: 'OFF-STN-001', barcode: '1234567890140', categoryName: 'Office Supplies', price: 5.99, cost: 2.00, taxRate: 15, stockQuantity: 200, lowStockThreshold: 50, unit: 'pcs', isActive: true },
  { storeId: storeIdObjectId, name: 'Ballpoint Pen Pack 10', sku: 'OFF-STN-002', barcode: '1234567890141', categoryName: 'Office Supplies', price: 8.99, cost: 3.00, taxRate: 15, stockQuantity: 100, lowStockThreshold: 25, unit: 'pack', isActive: true },
  { storeId: storeIdObjectId, name: 'Stapler', sku: 'OFF-STN-003', barcode: '1234567890142', categoryName: 'Office Supplies', price: 12.99, cost: 5.00, taxRate: 15, stockQuantity: 45, lowStockThreshold: 10, unit: 'pcs', isActive: true }
];

// Check if products already exist
const existingProducts = testDb.products.countDocuments({ storeId: storeIdObjectId });

if (existingProducts > 0) {
  print(`⚠ Found ${existingProducts} existing products.`);
  print('   Updating products with categoryId mapping...\n');
} else {
  print('No existing products found. Importing new products...\n');
}

let insertedProducts = 0;
let updatedProducts = 0;
let skippedProducts = 0;
const errors = [];

products.forEach(product => {
  try {
    const categoryId = categoryMap[product.categoryName];
    
    if (!categoryId) {
      skippedProducts++;
      print(`  ✗ Skipped: "${product.name}" - Category "${product.categoryName}" not found`);
      return;
    }
    
    // Prepare product document (remove categoryName, add categoryId)
    const productDoc = {
      storeId: storeIdObjectId,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: categoryId,
      price: product.price,
      cost: product.cost,
      taxRate: product.taxRate,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      unit: product.unit,
      isActive: product.isActive,
      syncVersion: 1
    };
    
    // Check if product exists by SKU
    const existing = testDb.products.findOne({ 
      storeId: storeIdObjectId, 
      sku: product.sku 
    });
    
    if (existing) {
      // Update existing product
      testDb.products.updateOne(
        { _id: existing._id },
        { 
          $set: productDoc,
          $unset: { categoryName: "" }
        }
      );
      updatedProducts++;
      print(`  ↻ Updated: "${product.name}"`);
    } else {
      // Insert new product
      testDb.products.insertOne(productDoc);
      insertedProducts++;
      print(`  ✓ Inserted: "${product.name}"`);
    }
  } catch (error) {
    errors.push({ product: product.name, error: error.message });
    skippedProducts++;
    print(`  ✗ Error: "${product.name}" - ${error.message}`);
  }
});

// ===== STEP 3: Summary =====
print('\n=== Import Summary ===');
print(`Categories available: ${Object.keys(categoryMap).length}`);
print(`Products inserted: ${insertedProducts}`);
print(`Products updated: ${updatedProducts}`);
print(`Products skipped: ${skippedProducts}`);

if (errors.length > 0) {
  print(`\nErrors encountered: ${errors.length}`);
  errors.forEach(err => {
    print(`  - ${err.product}: ${err.error}`);
  });
}

// ===== STEP 4: Verification =====
print('\n=== Verification ===');
const finalCategoryCount = testDb.categories.countDocuments({ storeId: storeIdObjectId });
const finalProductCount = testDb.products.countDocuments({ storeId: storeIdObjectId });
const productsWithCategoryId = testDb.products.countDocuments({
  storeId: storeIdObjectId,
  categoryId: { $exists: true, $ne: null }
});
const productsWithCategoryName = testDb.products.countDocuments({
  storeId: storeIdObjectId,
  categoryName: { $exists: true, $ne: null }
});

print(`Total categories: ${finalCategoryCount}`);
print(`Total products: ${finalProductCount}`);
print(`Products with categoryId: ${productsWithCategoryId}`);
print(`Products with categoryName: ${productsWithCategoryName}`);

if (productsWithCategoryName > 0) {
  print('\n⚠ Warning: Some products still have categoryName field.');
  print('   These will be cleaned up automatically on next sync.');
}

print('\n=== Import Complete ===');
print('Next steps:');
print('1. Verify data in MongoDB Compass');
print('2. Test API endpoint: GET /api/products');
print('3. Test API endpoint: GET /api/products/categories');
print('4. Verify frontend can sync and display data');
print('5. Run test-api-compatibility.js to verify data structure');

