const assert = require('assert');
const { profileDataset } = require('../src/services/profiler');
const { generateAnalysisPlan } = require('../src/services/llmPlanner');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');

console.log('--- RUNNING PSA01 SEMANTIC TYPING & IDENTIFIER REGRESSION SUITE ---');

// Build 1000-row dataset
const rows = [];
const categories = ['Electronics', 'Accessories', 'Furniture', 'Clothing'];
const regions = ['North', 'South', 'East', 'West'];
const products = ['Laptop', 'Mouse', 'Desk', 'Shirt', 'Keyboard'];

for (let i = 0; i < 1000; i++) {
  rows.push({
    Order_ID: 100001 + i,
    Sales: Number((100 + (i % 500) * 1.5).toFixed(2)),
    Quantity: (i % 10) + 1,
    Customer_Rating: Number((3.0 + (i % 20) * 0.1).toFixed(1)),
    Product: products[i % products.length],
    Category: categories[i % categories.length],
    Region: regions[i % regions.length],
    Order_Date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`
  });
}

// 1. Profile Dataset Verification
const profile = profileDataset(rows);
const columns = profile.columns;

const orderIdCol = columns.find(c => c.name === 'Order_ID');
const salesCol = columns.find(c => c.name === 'Sales');
const quantityCol = columns.find(c => c.name === 'Quantity');
const ratingCol = columns.find(c => c.name === 'Customer_Rating');
const catCol = columns.find(c => c.name === 'Category');
const dateCol = columns.find(c => c.name === 'Order_Date');

// Test 1: Order_ID classified as identifier with integer dataType
assert.strictEqual(orderIdCol.semanticType, 'identifier', 'Order_ID must be semanticType = identifier');
assert.strictEqual(orderIdCol.type, 'integer', 'Order_ID physical type must remain integer');
assert.strictEqual(orderIdCol.statistics, null, 'Order_ID must not compute mean/median/std statistics');
assert.notStrictEqual(orderIdCol.identifierStats, null, 'Order_ID must include identifierStats');
assert.strictEqual(orderIdCol.identifierStats.uniqueCount, 1000, 'Order_ID unique count must be 1000');
assert.strictEqual(orderIdCol.identifierStats.duplicateCount, 0, 'Order_ID duplicate count must be 0');
console.log('✓ PASS: Test 1 - Order_ID classified as identifier with integer storage type & no numeric stats');

// Test 2: Sales, Quantity, Customer_Rating remain measure
assert.strictEqual(salesCol.semanticType, 'measure', 'Sales must be semanticType = measure');
assert.strictEqual(quantityCol.semanticType, 'measure', 'Quantity must be semanticType = measure');
assert.strictEqual(ratingCol.semanticType, 'measure', 'Customer_Rating must be semanticType = measure');
assert.notStrictEqual(salesCol.statistics, null, 'Sales must have numerical statistics');
console.log('✓ PASS: Test 2 - Sales, Quantity, and Customer_Rating classified as analytical measures');

// Test 3: Category is categorical, Order_Date is datetime
assert.strictEqual(catCol.semanticType, 'categorical', 'Category must be semanticType = categorical');
assert.strictEqual(dateCol.semanticType, 'datetime', 'Order_Date must be semanticType = datetime');
console.log('✓ PASS: Test 3 - Category is categorical, Order_Date is datetime');

// Test 4: Average Order_ID is rejected with cannot_answer
(async () => {
  const planResult4 = await generateAnalysisPlan('What is the average Order_ID?', columns, { forceFallback: true });
  assert.strictEqual(planResult4.status, 'cannot_answer', 'Average Order_ID must be rejected');
  assert.ok(planResult4.reason.includes('Order_ID'), 'Reason must explicitly mention Order_ID');
  console.log('✓ PASS: Test 4 - "What is the average Order_ID?" rejected with cannot_answer');

  // Test 5: Total Order_ID by region rejected
  const planResult5 = await generateAnalysisPlan('Show total Order_ID by region', columns, { forceFallback: true });
  assert.strictEqual(planResult5.status, 'cannot_answer', 'Total Order_ID by region must be rejected');
  console.log('✓ PASS: Test 5 - "Show total Order_ID by region" rejected with cannot_answer');

  // Test 6: Correlation between Order_ID and Sales rejected
  const planResult6 = await generateAnalysisPlan('Correlation between Order_ID and Sales', columns, { forceFallback: true });
  assert.strictEqual(planResult6.status, 'cannot_answer', 'Correlation with Order_ID must be rejected');
  console.log('✓ PASS: Test 6 - "Correlation between Order_ID and Sales" rejected with cannot_answer');

  // Test 7: COUNT(Order_ID) works
  const planResult7 = await generateAnalysisPlan('How many orders are there?', columns, { forceFallback: true });
  assert.strictEqual(planResult7.status, 'validated', 'COUNT(Order_ID) plan must be valid');
  assert.strictEqual(planResult7.plan.operation, 'count', 'Operation must be count');
  const execResult7 = executeAnalysisPlan(planResult7.plan, rows);
  assert.strictEqual(execResult7.status, 'success');
  assert.strictEqual(execResult7.result[0].count, 1000, 'Count must equal 1000');
  console.log('✓ PASS: Test 7 - "How many orders are there?" -> COUNT(Order_ID) works (result: 1000)');

  // Test 8: DISTINCT COUNT(Order_ID) / Unique orders works
  const planResult8 = await generateAnalysisPlan('How many unique Order_ID entries are there?', columns, { forceFallback: true });
  assert.strictEqual(planResult8.status, 'validated', 'Distinct count Order_ID plan must be valid');
  const execResult8 = executeAnalysisPlan(planResult8.plan, rows);
  assert.strictEqual(execResult8.status, 'success');
  assert.strictEqual(execResult8.result[0].count, 1000);
  console.log('✓ PASS: Test 8 - "How many unique Order_ID entries are there?" works');

  // Test 9: Legitimate numerical analytics continue working (Sales by Region)
  const planResult9 = await generateAnalysisPlan('Show total sales by region', columns, { forceFallback: true });
  assert.strictEqual(planResult9.status, 'validated', 'Total sales by region plan must be valid');
  const execResult9 = executeAnalysisPlan(planResult9.plan, rows);
  assert.strictEqual(execResult9.status, 'success');
  assert.strictEqual(execResult9.result.length, 4, 'Should yield 4 regions');
  console.log('✓ PASS: Test 9 - Legitimate analytical measure queries (Sales by region) work as expected');

  console.log('\nSEMANTIC TYPING TEST RESULTS: 9/9 tests passed.');
})();
