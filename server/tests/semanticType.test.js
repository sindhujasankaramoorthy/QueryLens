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

  // Test 10: Medical Dataset Schema Classification & Query Regression
  const medicalRows = [
    { Patient_ID: 'P001', Age: 45, Gender: 'Male', Temperature_F: 98.6, SpO2_Percent: 98, Heart_Rate_BPM: 72, Blood_Pressure: '120/80', Symptoms: 'Normal' },
    { Patient_ID: 'P002', Age: 62, Gender: 'Female', Temperature_F: 99.1, SpO2_Percent: 96, Heart_Rate_BPM: 80, Blood_Pressure: '130/85', Symptoms: 'Mild Cough' },
    { Patient_ID: 'P003', Age: 58, Gender: 'Male', Temperature_F: 100.1, SpO2_Percent: 94, Heart_Rate_BPM: 92, Blood_Pressure: '140/90', Symptoms: 'Fever' },
    { Patient_ID: 'P004', Age: 71, Gender: 'Female', Temperature_F: 102.4, SpO2_Percent: 91, Heart_Rate_BPM: 105, Blood_Pressure: '150/95', Symptoms: 'High Fever' },
    { Patient_ID: 'P005', Age: 29, Gender: 'Male', Temperature_F: 98.4, SpO2_Percent: 99, Heart_Rate_BPM: 68, Blood_Pressure: '118/75', Symptoms: 'None' },
    { Patient_ID: 'P006', Age: 65, Gender: 'Female', Temperature_F: 103.1, SpO2_Percent: 89, Heart_Rate_BPM: 110, Blood_Pressure: '160/100', Symptoms: 'Severe Fever' },
    { Patient_ID: 'P007', Age: 40, Gender: 'Male', Temperature_F: 98.8, SpO2_Percent: 97, Heart_Rate_BPM: 75, Blood_Pressure: '122/80', Symptoms: 'Fatigue' },
    { Patient_ID: 'P008', Age: 78, Gender: 'Female', Temperature_F: 101.5, SpO2_Percent: 93, Heart_Rate_BPM: 88, Blood_Pressure: '145/92', Symptoms: 'Fever' },
    { Patient_ID: 'P009', Age: 34, Gender: 'Male', Temperature_F: 97.9, SpO2_Percent: 98, Heart_Rate_BPM: 70, Blood_Pressure: '115/72', Symptoms: 'None' },
    { Patient_ID: 'P010', Age: 82, Gender: 'Female', Temperature_F: 102.8, SpO2_Percent: 90, Heart_Rate_BPM: 102, Blood_Pressure: '155/96', Symptoms: 'High Fever' },
    { Patient_ID: 'P011', Age: 50, Gender: 'Male', Temperature_F: 99.5, SpO2_Percent: 95, Heart_Rate_BPM: 78, Blood_Pressure: '128/82', Symptoms: 'Headache' },
    { Patient_ID: 'P012', Age: 22, Gender: 'Female', Temperature_F: 98.2, SpO2_Percent: 99, Heart_Rate_BPM: 65, Blood_Pressure: '110/70', Symptoms: 'None' }
  ];

  const medProfile = profileDataset(medicalRows);
  const medCols = medProfile.columns;

  assert.strictEqual(medCols.find(c => c.name === 'Patient_ID').semanticType, 'identifier');
  assert.strictEqual(medCols.find(c => c.name === 'Age').semanticType, 'measure');
  assert.strictEqual(medCols.find(c => c.name === 'Temperature_F').semanticType, 'measure');
  assert.strictEqual(medCols.find(c => c.name === 'SpO2_Percent').semanticType, 'measure');
  assert.strictEqual(medCols.find(c => c.name === 'Heart_Rate_BPM').semanticType, 'measure');
  assert.strictEqual(medCols.find(c => c.name === 'Gender').semanticType, 'categorical');

  // Medical Query 1: "Show the average temperature by gender."
  const medPlan1 = await generateAnalysisPlan('Show the average temperature by gender.', medCols, { forceFallback: true });
  assert.strictEqual(medPlan1.status, 'validated');
  assert.strictEqual(medPlan1.plan.operation, 'group_aggregate');
  const medExec1 = executeAnalysisPlan(medPlan1.plan, medicalRows);
  assert.strictEqual(medExec1.status, 'success');

  // Medical Query 2: "Which patients have high temperature and low SpO2?"
  const medPlan2 = await generateAnalysisPlan('Which patients have high temperature and low SpO2?', medCols, { forceFallback: true });
  assert.strictEqual(medPlan2.status, 'validated');
  assert.strictEqual(medPlan2.plan.operation, 'select');
  const medExec2 = executeAnalysisPlan(medPlan2.plan, medicalRows);
  assert.strictEqual(medExec2.status, 'success');
  assert.deepStrictEqual(medExec2.result.map(r => r.Patient_ID), ['P003', 'P004', 'P006', 'P008', 'P010']);

  // Medical Query 3: "What is the correlation between Temperature_F and Heart_Rate_BPM?"
  const medPlan3 = await generateAnalysisPlan('What is the correlation between Temperature_F and Heart_Rate_BPM?', medCols, { forceFallback: true });
  assert.strictEqual(medPlan3.status, 'validated');
  assert.strictEqual(medPlan3.plan.operation, 'correlation');
  const medExec3 = executeAnalysisPlan(medPlan3.plan, medicalRows);
  assert.strictEqual(medExec3.status, 'success');
  assert.strictEqual(medExec3.result[0].correlation, 0.9631);

  console.log('✓ PASS: Test 10 - Medical dataset schema classification & 3 query regression tests passed');

  console.log('\nSEMANTIC TYPING TEST RESULTS: 10/10 tests passed.');
})();
