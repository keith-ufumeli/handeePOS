/**
 * MongoDB Import Script for Products with Category Name Mapping
 * 
 * This script imports products from CSV and automatically maps category names to category IDs
 * 
 * Usage:
 * 1. First import categories.csv using mongoimport
 * 2. Update STORE_ID and DB_NAME below
 * 3. Run: mongo handeepos import-script.js
 * 
 * Or use MongoDB Compass:
 * 1. Import categories.csv first
 * 2. Import products.csv (with categoryName column)
 * 3. Run this script to update categoryId references
 */

// ===== CONFIGURATION - UPDATE THESE VALUES =====
const STORE_ID = '68f9f9a4ec280ec966a51aba'; // Replace with your store ID
const DB_NAME = 'test'; // Replace with your database name
// ================================================

// Connect to database
const db = db.getSiblingDB(DB_NAME);

print('=== MongoDB Product Import Script ===\n');
print(`Database: ${DB_NAME}`);
print(`Store ID: ${STORE_ID}\n`);

// Step 1: Get category mapping (name -> _id)
print('Step 1: Building category mapping...');
const categoryMap = {};
let categoryCount = 0;
// @ts-ignore
// eslint-disable-next-line no-undef
db.categories.find({ storeId: ObjectId(STORE_ID) }).forEach(category => {
  categoryMap[category.name] = category._id;
  categoryCount++;
  print(`  Found category: "${category.name}" -> ${category._id}`);
});

if (categoryCount === 0) {
  print('\nERROR: No categories found! Please import categories.csv first.');
  print('Run: mongoimport --collection=categories --type=csv --headerline --file=categories.csv');
  // @ts-ignore
  // eslint-disable-next-line no-undef
    quit(1);
}

print(`\nTotal categories mapped: ${categoryCount}\n`);

// Step 2: Find products with categoryName that need updating
print('Step 2: Finding products with categoryName...');
const productsToUpdate = db.products.find({
  // @ts-ignore
  // eslint-disable-next-line no-undef
  storeId: ObjectId(STORE_ID),
  categoryName: { $exists: true, $ne: null }
}).toArray();

print(`Found ${productsToUpdate.length} products with categoryName\n`);

if (productsToUpdate.length === 0) {
  print('No products found with categoryName field.');
  print('If you imported products-with-categoryids.csv, you may need to update categoryId manually.');
  
  // @ts-ignore
  // eslint-disable-next-line no-undef
  quit(0);
}

// Step 3: Update products with category IDs
print('Step 3: Updating products with category IDs...');
let updated = 0;
let skipped = 0;
const errors = [];

productsToUpdate.forEach(product => {
  const categoryName = product.categoryName;
  const categoryId = categoryMap[categoryName];
  
  if (categoryId) {
    try {
      db.products.updateOne(
        { _id: product._id },
        { 
          $set: { categoryId: categoryId },
          $unset: { categoryName: "" }
        }
      );
      updated++;
      print(`  ✓ Updated: "${product.name}" -> Category: "${categoryName}"`);
    } catch (error) {
      errors.push({ product: product.name, error: error.message });
      skipped++;
      print(`  ✗ Error updating "${product.name}": ${error.message}`);
    }
  } else {
    skipped++;
    print(`  ✗ Warning: Category "${categoryName}" not found for product "${product.name}"`);
  }
});

// Step 4: Summary
print('\n=== Import Summary ===');
print(`Products updated: ${updated}`);
print(`Products skipped: ${skipped}`);

if (errors.length > 0) {
  print(`\nErrors encountered: ${errors.length}`);
  errors.forEach(err => {
    print(`  - ${err.product}: ${err.error}`);
  });
}

// Step 5: Verify results
print('\n=== Verification ===');
const productsWithCategoryId = db.products.countDocuments({
  // @ts-ignore
  // eslint-disable-next-line no-undef
  storeId: ObjectId(STORE_ID),
  categoryId: { $exists: true, $ne: null }
});

const productsWithCategoryName = db.products.countDocuments({
  // @ts-ignore
  // eslint-disable-next-line no-undef
  storeId: ObjectId(STORE_ID),
  categoryName: { $exists: true, $ne: null }
});

print(`Products with categoryId: ${productsWithCategoryId}`);
print(`Products still with categoryName: ${productsWithCategoryName}`);

if (productsWithCategoryName > 0) {
  print('\n⚠ Warning: Some products still have categoryName field.');
  print('These may need manual categoryId assignment.');
}

print('\n=== Import Complete ===');
print('Next steps:');
print('1. Verify products in MongoDB Compass');
print('2. Test API endpoint: GET /api/products');
print('3. Verify frontend can sync and display products');

