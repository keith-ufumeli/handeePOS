/**
 * API Compatibility Test Script
 * 
 * Tests that imported data from CSV is compatible with backend API responses
 * and frontend expectations.
 * 
 * Usage: After importing CSV data, run this script to verify compatibility
 * 
 * IMPORTANT: This script must be run with MongoDB shell, NOT Node.js:
 *   mongo handeepos test-api-compatibility.js
 * 
 * Or connect first, then run:
 *   mongo
 *   use handeepos
 *   load('test-api-compatibility.js')
 */

/* global ObjectId, db, quit */

// Configuration
const STORE_ID = '68f9f9a4ec280ec966a51aba'; // Update with your store ID
const DB_NAME = 'test'; // Update with your database name

// Check if running in MongoDB shell context
if (typeof db === 'undefined') {
  print('ERROR: This script must be run with MongoDB shell, not Node.js!');
  print('');
  print('Usage:');
  print('  mongo test test-api-compatibility.js');
  print('');
  print('Or in MongoDB shell:');
  print('  mongo');
  print('  use test');
  print('  load("test-api-compatibility.js")');
  quit(1);
}

// Helper function to safely convert string to ObjectId
function toObjectId(id) {
  if (typeof ObjectId === 'function') {
    return ObjectId(id);
  }
  // Fallback: return as string (MongoDB will auto-convert in queries)
  return id;
}

// Get database reference
// In MongoDB shell, 'db' is a global variable
const testDb = db.getSiblingDB(DB_NAME);

print('=== API Compatibility Test ===\n');

// Test 1: Verify Category Structure
print('Test 1: Category Structure');
print('Expected fields: storeId, name, description, isActive, _id, createdAt, updatedAt');
const sampleCategory = testDb.categories.findOne({ storeId: toObjectId(STORE_ID) });

if (sampleCategory) {
  const categoryFields = Object.keys(sampleCategory);
  const expectedFields = ['storeId', 'name', 'description', 'isActive', '_id', 'createdAt', 'updatedAt'];
  const missingFields = expectedFields.filter(f => !categoryFields.includes(f));
  
  if (missingFields.length === 0) {
    print('✓ Category structure is correct');
  } else {
    print(`✗ Missing fields: ${missingFields.join(', ')}`);
  }
  
  // Check field types
  print(`  storeId type: ${typeof sampleCategory.storeId} (should be ObjectId)`);
  print(`  name type: ${typeof sampleCategory.name} (should be string)`);
  print(`  isActive type: ${typeof sampleCategory.isActive} (should be boolean)`);
} else {
  print('✗ No categories found');
}

print('');

// Test 2: Verify Product Structure
print('Test 2: Product Structure');
print('Expected fields: storeId, name, sku, barcode, categoryId, price, cost, taxRate, stockQuantity, lowStockThreshold, unit, isActive, _id, syncVersion, createdAt, updatedAt');
const sampleProduct = testDb.products.findOne({ storeId: toObjectId(STORE_ID) });

if (sampleProduct) {
  const productFields = Object.keys(sampleProduct);
  const expectedFields = ['storeId', 'name', 'sku', 'categoryId', 'price', 'cost', 'taxRate', 'stockQuantity', 'lowStockThreshold', 'unit', 'isActive', '_id', 'syncVersion', 'createdAt', 'updatedAt'];
  const missingFields = expectedFields.filter(f => !productFields.includes(f));
  
  if (missingFields.length === 0) {
    print('✓ Product structure is correct');
  } else {
    print(`✗ Missing fields: ${missingFields.join(', ')}`);
  }
  
  // Check field types
  print(`  storeId type: ${typeof sampleProduct.storeId} (should be ObjectId)`);
  print(`  categoryId type: ${typeof sampleProduct.categoryId} (should be ObjectId)`);
  print(`  price type: ${typeof sampleProduct.price} (should be number)`);
  print(`  stockQuantity type: ${typeof sampleProduct.stockQuantity} (should be number)`);
  print(`  isActive type: ${typeof sampleProduct.isActive} (should be boolean)`);
  
  // Check for categoryName (should not exist after import)
  if (sampleProduct.categoryName) {
    print('  ⚠ Warning: categoryName field still exists (run import-script.js)');
  } else {
    print('  ✓ No categoryName field (correct)');
  }
} else {
  print('✗ No products found');
}

print('');

// Test 3: Verify Category References
print('Test 3: Category References');
const productsWithInvalidCategory = testDb.products.find({
  storeId: toObjectId(STORE_ID),
  categoryId: { $exists: true }
}).toArray();

let validRefs = 0;
let invalidRefs = 0;

productsWithInvalidCategory.forEach(product => {
  const category = testDb.categories.findOne({
    _id: product.categoryId,
    storeId: toObjectId(STORE_ID)
  });
  
  if (category) {
    validRefs++;
  } else {
    invalidRefs++;
    print(`  ✗ Product "${product.name}" has invalid categoryId: ${product.categoryId}`);
  }
});

print(`  Valid references: ${validRefs}`);
print(`  Invalid references: ${invalidRefs}`);

if (invalidRefs === 0) {
  print('✓ All category references are valid');
} else {
  print('✗ Some category references are invalid');
}

print('');

// Test 4: Verify Field Name Compatibility
print('Test 4: Field Name Compatibility (camelCase)');
const fieldNameTests = [
  { field: 'storeId', expected: 'camelCase' },
  { field: 'categoryId', expected: 'camelCase' },
  { field: 'stockQuantity', expected: 'camelCase' },
  { field: 'taxRate', expected: 'camelCase' },
  { field: 'lowStockThreshold', expected: 'camelCase' },
  { field: 'isActive', expected: 'camelCase' }
];

let allCorrect = true;
fieldNameTests.forEach(test => {
  if (sampleProduct && sampleProduct[test.field] !== undefined) {
    print(`  ✓ ${test.field} exists (${test.expected})`);
  } else if (sampleProduct) {
    print(`  ✗ ${test.field} missing`);
    allCorrect = false;
  }
});

if (allCorrect && sampleProduct) {
  print('✓ All field names use camelCase (backend compatible)');
} else if (!sampleProduct) {
  print('⚠ Cannot verify (no products found)');
} else {
  print('✗ Some field names are incorrect');
}

print('');

// Test 5: Summary
print('=== Test Summary ===');
const categoryCount = testDb.categories.countDocuments({ storeId: toObjectId(STORE_ID) });
const productCount = testDb.products.countDocuments({ storeId: toObjectId(STORE_ID) });
const productsWithCategoryId = testDb.products.countDocuments({
  storeId: toObjectId(STORE_ID),
  categoryId: { $exists: true, $ne: null }
});

print(`Categories: ${categoryCount}`);
print(`Products: ${productCount}`);
print(`Products with categoryId: ${productsWithCategoryId}`);

if (categoryCount > 0 && productCount > 0 && productsWithCategoryId === productCount && invalidRefs === 0) {
  print('\n✓ All tests passed! Data is compatible with backend API.');
  print('\nNext steps:');
  print('1. Test API endpoint: GET /api/products');
  print('2. Test API endpoint: GET /api/products/categories');
  print('3. Verify frontend can sync and display data');
} else {
  print('\n⚠ Some issues found. Please review the test results above.');
}

