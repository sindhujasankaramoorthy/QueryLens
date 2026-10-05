const assert = require('assert');
const { profileDataset } = require('../src/services/profiler');
const { generateDatasetInsights } = require('../src/services/insightEngine');

console.log('--- RUNNING PSA01 PHASE 8 DATA QUALITY & CLEAN DATA VALIDATION TEST SUITE ---');

// Test Scenario 1: Clean Dataset
const cleanRows = [
  { Order_ID: 101, Sales: 150.0, Quantity: 2, Region: 'North', Order_Date: '2025-01-01' },
  { Order_ID: 102, Sales: 250.0, Quantity: 3, Region: 'South', Order_Date: '2025-01-02' },
  { Order_ID: 103, Sales: 350.0, Quantity: 4, Region: 'East', Order_Date: '2025-01-03' },
  { Order_ID: 104, Sales: 450.0, Quantity: 5, Region: 'West', Order_Date: '2025-01-04' }
];

const profileClean = profileDataset(cleanRows);
assert.strictEqual(profileClean.qualitySummary.overallStatus, 'CLEAN', 'Clean dataset overallStatus must be CLEAN');
assert.strictEqual(
  profileClean.qualitySummary.statusMessage,
  'No major data-quality issues detected. The dataset is suitable for analysis.',
  'Clean dataset statusMessage must match exact specification'
);
assert.strictEqual(profileClean.qualitySummary.metrics.totalMissing, 0, 'Clean dataset missing count must be 0');
assert.strictEqual(profileClean.qualitySummary.metrics.totalDuplicates, 0, 'Clean dataset duplicates count must be 0');
assert.strictEqual(profileClean.qualitySummary.metrics.totalInvalid, 0, 'Clean dataset invalid count must be 0');
console.log('✓ PASS: Test 1 - Clean dataset validation & exact CLEAN status message');

// Test Scenario 2: Dataset containing Missing Values
const missingRows = [
  { Order_ID: 101, Sales: 150.0, Region: 'North' },
  { Order_ID: 102, Sales: null, Region: 'South' },
  { Order_ID: 103, Sales: 350.0, Region: null },
  { Order_ID: 104, Sales: 450.0, Region: 'West' }
];

const profileMissing = profileDataset(missingRows);
const salesColMissing = profileMissing.columns.find(c => c.name === 'Sales');
assert.strictEqual(salesColMissing.missingCount, 1, 'Sales column missingCount must be 1');
assert.strictEqual(salesColMissing.missingPercentage, 0.25, 'Sales column missingPercentage must be 0.25 (25%)');
assert.strictEqual(profileMissing.qualitySummary.metrics.totalMissing, 2, 'Total dataset missing cells must be 2');
console.log('✓ PASS: Test 2 - Dataset containing missing values detection');

// Test Scenario 3: Dataset containing Duplicate Rows
const duplicateRows = [
  { Order_ID: 101, Sales: 100.0, Region: 'North' },
  { Order_ID: 101, Sales: 100.0, Region: 'North' }, // Duplicate
  { Order_ID: 102, Sales: 200.0, Region: 'South' },
  { Order_ID: 103, Sales: 300.0, Region: 'East' }
];

const profileDuplicates = profileDataset(duplicateRows);
assert.strictEqual(profileDuplicates.duplicates.count, 1, 'Total duplicate row count must be 1');
assert.strictEqual(profileDuplicates.duplicates.percentage, 0.25, 'Duplicate percentage must be 0.25 (25%)');
console.log('✓ PASS: Test 3 - Duplicate row detection');

// Test Scenario 4: Dataset containing Categorical Inconsistencies (Capitalization/Spelling)
const caseRows = [
  { Order_ID: 101, Category: 'Electronics' },
  { Order_ID: 102, Category: 'electronics' }, // Inconsistent case
  { Order_ID: 103, Category: 'ELECTRONICS' }, // Inconsistent case
  { Order_ID: 104, Category: 'Furniture' }
];

const profileCase = profileDataset(caseRows);
const catColCase = profileCase.columns.find(c => c.name === 'Category');
assert.notStrictEqual(catColCase.caseInconsistency, null, 'Category column must report caseInconsistency');
assert.strictEqual(catColCase.status, 'Warning', 'Column with case inconsistency must have Warning status');
console.log('✓ PASS: Test 4 - Categorical spelling/capitalization inconsistency detection');

// Test Scenario 5: Dataset containing Numerical IQR Outliers
const outlierRows = [];
for (let i = 0; i < 20; i++) {
  outlierRows.push({ Order_ID: 100 + i, Sales: 100 + i * 2 });
}
outlierRows.push({ Order_ID: 120, Sales: 9999.0 }); // Statistical outlier

const profileOutlier = profileDataset(outlierRows);
const salesColOutlier = profileOutlier.columns.find(c => c.name === 'Sales');
assert.strictEqual(salesColOutlier.outlierCount, 1, 'Sales column must detect 1 IQR outlier');

const insightsOutlier = generateDatasetInsights(outlierRows, profileOutlier.columns);
const outlierInsight = insightsOutlier.insights.find(i => i.insightType === 'outliers');
assert.ok(outlierInsight, 'Outlier insight must be generated');
assert.ok(outlierInsight.whyItMatters.includes('statistically unusual data points'), 'Why it matters must clarify statistical nature');
console.log('✓ PASS: Test 5 - Numerical IQR outlier detection & non-punitive explainability');

// Test Scenario 6: Dataset containing Invalid Numerical Values (Negative metrics)
const invalidRows = [
  { Order_ID: 101, Sales: 100.0, Quantity: 2 },
  { Order_ID: 102, Sales: -500.0, Quantity: 5 }, // Invalid negative sales
  { Order_ID: 103, Sales: 200.0, Quantity: -3 }  // Invalid negative quantity
];

const profileInvalid = profileDataset(invalidRows);
const salesColInvalid = profileInvalid.columns.find(c => c.name === 'Sales');
const qtyColInvalid = profileInvalid.columns.find(c => c.name === 'Quantity');
assert.strictEqual(salesColInvalid.invalidCount, 1, 'Sales column must report 1 invalid negative value');
assert.strictEqual(qtyColInvalid.invalidCount, 1, 'Quantity column must report 1 invalid negative value');
assert.strictEqual(profileInvalid.qualitySummary.overallStatus, 'CRITICAL', 'Dataset with invalid values must have CRITICAL status');
console.log('✓ PASS: Test 6 - Invalid negative value detection in non-negative metrics');

// Test Scenario 7: Order_ID Identifier Rule
const orderIdCol = profileClean.columns.find(c => c.name === 'Order_ID');
assert.strictEqual(orderIdCol.semanticType, 'identifier', 'Order_ID must have semanticType = identifier');
assert.strictEqual(orderIdCol.statistics, null, 'Order_ID must not compute numerical statistics');
assert.strictEqual(orderIdCol.outlierCount, 0, 'Order_ID must not compute numerical outliers');
console.log('✓ PASS: Test 7 - Order_ID identifier rule (no statistics/outliers computed)');

// Test Scenario 8: 1000-Row Dataset with Low Missing % & Statistical Outliers (Expecting WARNING status, NOT CRITICAL)
const largeDatasetRows = [];
for (let i = 0; i < 1000; i++) {
  largeDatasetRows.push({
    Order_ID: 100001 + i,
    Sales: i < 100 ? 99999 : 100 + (i % 50), // 100 statistical outliers
    Quantity: (i % 5) + 1,
    Customer_Rating: (i % 30 === 0 && i < 960) ? null : 4.5, // 32 missing cells
    Category: (i % 2 === 0) ? 'Electronics' : 'Accessories',
    Region: 'North',
    City: 'New York',
    Payment_Method: 'Card',
    Segment: 'Consumer',
    Order_Date: '2025-01-01'
  });
}

const profileLarge = profileDataset(largeDatasetRows);
assert.strictEqual(profileLarge.qualitySummary.overallStatus, 'WARNING', 'Dataset with low missing % and outliers must be WARNING, not CRITICAL');
assert.ok(profileLarge.qualitySummary.statusMessage.includes('Minor data-quality issues detected'), 'Status message must report minor issues');
console.log('✓ PASS: Test 8 - 1000-row dataset with low missing values (0.32%) & outliers classified as WARNING (not CRITICAL)');

console.log('\nPHASE 8 DATA QUALITY TEST RESULTS: 8/8 tests passed.');
