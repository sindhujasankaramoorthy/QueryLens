const assert = require('assert');
const { calculateIQRStats, generateDatasetInsights, generateInsightExplanation } = require('../src/services/insightEngine');

console.log('--- RUNNING PSA01 PHASE 6 TEST SUITE ---');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
  }
}

(async () => {
  // Test 1: Dataset A - Missing Value Detection & Percentage
  await runTest('Test 1 - Missing Value Detection & Percentage (Dataset A)', () => {
    const datasetA = [
      { Col1: 'Val1', Customer_Rating: 4.5 },
      { Col1: 'Val2', Customer_Rating: null },
      { Col1: 'Val3', Customer_Rating: 4.0 },
      { Col1: 'Val4', Customer_Rating: 5.0 }
    ];
    const res = generateDatasetInsights(datasetA, ['Col1', 'Customer_Rating']);
    const missingInsight = res.insights.find(i => i.insightType === 'missing_values' && i.column === 'Customer_Rating');

    assert.ok(missingInsight, 'Missing values insight should be generated');
    assert.strictEqual(missingInsight.evidence.missingCount, 1);
    assert.strictEqual(missingInsight.evidence.missingPercentage, 25);
    assert.strictEqual(missingInsight.evidence.rowCount, 4);
    assert.strictEqual(missingInsight.evidence.nonMissingCount, 3);
  });

  // Test 2: Dataset B - Duplicate Rows Detection
  await runTest('Test 2 - Duplicate Rows Detection (Dataset B)', () => {
    const datasetB = [
      { ID: 1, Category: 'Tech', Price: 100 },
      { ID: 1, Category: 'Tech', Price: 100 },
      { ID: 2, Category: 'Home', Price: 200 },
      { ID: 2, Category: 'Home', Price: 200 }
    ];
    const res = generateDatasetInsights(datasetB, ['ID', 'Category', 'Price']);
    const dupInsight = res.insights.find(i => i.insightType === 'duplicates');

    assert.ok(dupInsight, 'Duplicates insight should be generated');
    assert.strictEqual(dupInsight.evidence.duplicateCount, 2);
    assert.strictEqual(dupInsight.evidence.duplicatePercentage, 50);
  });

  // Test 3: Dataset C - Numerical IQR Outlier Detection
  await runTest('Test 3 - IQR Outlier Detection (Dataset C)', () => {
    const datasetC = [
      { Price: 10 }, { Price: 12 }, { Price: 11 }, { Price: 13 }, { Price: 12 },
      { Price: 14 }, { Price: 11 }, { Price: 15 }, { Price: 1000 } // 1000 is an outlier
    ];
    const rows = datasetC.map(r => r.Price);
    const iqr = calculateIQRStats(rows);

    assert.ok(iqr);
    assert.strictEqual(iqr.outlierCount, 1);
    assert.ok(iqr.sampleOutliers.includes(1000));
    assert.ok(iqr.upperBound < 1000);

    const res = generateDatasetInsights(datasetC, ['Price']);
    const outlierInsight = res.insights.find(i => i.insightType === 'outliers');
    assert.ok(outlierInsight);
    assert.strictEqual(outlierInsight.column, 'Price');
  });

  // Test 4: Dataset D - Categorical Distribution & Dominant Category
  await runTest('Test 4 - Categorical Distribution & Dominant Category (Dataset D)', () => {
    const datasetD = [
      { Region: 'North' }, { Region: 'North' }, { Region: 'North' }, { Region: 'North' },
      { Region: 'South' }
    ];
    const res = generateDatasetInsights(datasetD, ['Region']);
    const domInsight = res.insights.find(i => i.insightType === 'dominant_category');

    assert.ok(domInsight);
    assert.strictEqual(domInsight.evidence.dominantCategory, 'North');
    assert.strictEqual(domInsight.evidence.dominantCount, 4);
    assert.strictEqual(domInsight.evidence.dominantPercentage, 80);
  });

  // Test 5: Dataset E - Constant Column & Mixed Types
  await runTest('Test 5 - Constant Column Detection (Dataset E)', () => {
    const datasetE = [
      { Status: 'Active', Score: 10 },
      { Status: 'Active', Score: 20 },
      { Status: 'Active', Score: 30 }
    ];
    const res = generateDatasetInsights(datasetE, ['Status', 'Score']);
    const constInsight = res.insights.find(i => i.insightType === 'low_variation');

    assert.ok(constInsight);
    assert.strictEqual(constInsight.column, 'Status');
    assert.strictEqual(constInsight.evidence.constantValue, 'Active');
  });

  // Test 6: Dataset F - Clean Dataset Handling
  await runTest('Test 6 - Clean Dataset Handling (Dataset F)', () => {
    const datasetF = [
      { A: 1, B: 'X' },
      { A: 2, B: 'Y' },
      { A: 3, B: 'Z' }
    ];
    const res = generateDatasetInsights(datasetF, ['A', 'B']);
    const criticals = res.insights.filter(i => i.severity === 'high');
    assert.strictEqual(criticals.length, 0);
  });

  // Test 7: Dataset G - Generic Schema Agnostic Behavior
  await runTest('Test 7 - Generic Schema Agnostic Behavior (Dataset G)', () => {
    const datasetG = [
      { Student_Name: 'Alice', Department: 'CS', Marks: 95 },
      { Student_Name: 'Bob', Department: 'CS', Marks: 85 },
      { Student_Name: 'Charlie', Department: 'CS', Marks: null },
      { Student_Name: 'Dave', Department: 'ECE', Marks: 70 }
    ];
    const res = generateDatasetInsights(datasetG, ['Student_Name', 'Department', 'Marks']);
    assert.strictEqual(res.rowCount, 4);
    assert.strictEqual(res.columnCount, 3);

    const missingMarks = res.insights.find(i => i.column === 'Marks' && i.insightType === 'missing_values');
    assert.ok(missingMarks);

    const domDept = res.insights.find(i => i.column === 'Department' && (i.insightType === 'dominant_category' || i.insightType === 'category_distribution'));
    assert.ok(domDept);
    assert.ok(domDept.observation.includes('CS'));
  });

  // Test 8: Sales Dataset Discovery (Dynamic 20 Rows)
  await runTest('Test 8 - Existing Sales Dataset Discovery', () => {
    const salesDataset = [
      { Order_ID: 1001, Product: 'Laptop', Region: 'North', Sales: 120000, Quantity: 40, Customer_Rating: 4.5 },
      { Order_ID: 1002, Product: 'Phone', Region: 'North', Sales: 47000, Quantity: 20, Customer_Rating: 4.0 },
      { Order_ID: 1003, Product: 'Headphones', Region: 'North', Sales: 18000, Quantity: 15, Customer_Rating: 4.2 },
      { Order_ID: 1004, Product: 'Keyboard', Region: 'North', Sales: 15000, Quantity: 5, Customer_Rating: 4.8 },
      { Order_ID: 1005, Product: 'Mouse', Region: 'North', Sales: 18000, Quantity: 5, Customer_Rating: 4.1 },
      { Order_ID: 1006, Product: 'Laptop', Region: 'South', Sales: 110000, Quantity: 25, Customer_Rating: 4.6 },
      { Order_ID: 1007, Product: 'Phone', Region: 'South', Sales: 50000, Quantity: 20, Customer_Rating: 4.3 },
      { Order_ID: 1008, Product: 'Headphones', Region: 'South', Sales: 12000, Quantity: 10, Customer_Rating: 3.9 },
      { Order_ID: 1009, Product: 'Keyboard', Region: 'South', Sales: 10500, Quantity: 5, Customer_Rating: 4.0 },
      { Order_ID: 1010, Product: 'Mouse', Region: 'South', Sales: 1000, Quantity: 1, Customer_Rating: 4.5 },
      { Order_ID: 1011, Product: 'Laptop', Region: 'East', Sales: 80000, Quantity: 20, Customer_Rating: 4.7 },
      { Order_ID: 1012, Product: 'Phone', Region: 'East', Sales: 50000, Quantity: 25, Customer_Rating: 4.2 },
      { Order_ID: 1013, Product: 'Headphones', Region: 'East', Sales: 14000, Quantity: 15, Customer_Rating: 4.4 },
      { Order_ID: 1014, Product: 'Mouse', Region: 'East', Sales: 12500, Quantity: 15, Customer_Rating: 3.8 },
      { Order_ID: 1015, Product: 'Laptop', Region: 'East', Sales: 6000, Quantity: 6, Customer_Rating: 4.0 },
      { Order_ID: 1016, Product: 'Laptop', Region: 'West', Sales: 64000, Quantity: 15, Customer_Rating: 4.1 },
      { Order_ID: 1017, Product: 'Phone', Region: 'West', Sales: 100000, Quantity: 30, Customer_Rating: 4.6 },
      { Order_ID: 1018, Product: 'Headphones', Region: 'West', Sales: 10000, Quantity: 5, Customer_Rating: 4.3 },
      { Order_ID: 1019, Product: 'Mouse', Region: 'West', Sales: -7000, Quantity: 1, Customer_Rating: 3.5 },
      { Order_ID: 1020, Product: 'Laptop', Region: 'West', Sales: -8000, Quantity: 5, Customer_Rating: null }
    ];

    const res = generateDatasetInsights(salesDataset, ['Order_ID', 'Product', 'Region', 'Sales', 'Quantity', 'Customer_Rating']);

    assert.strictEqual(res.rowCount, 20);

    const missingRating = res.insights.find(i => i.column === 'Customer_Rating' && i.insightType === 'missing_values');
    assert.ok(missingRating);
    assert.strictEqual(missingRating.evidence.missingCount, 1);
    assert.strictEqual(missingRating.evidence.missingPercentage, 5);
  });

  // Test 9: AI Explanation Evidence Grounding
  await runTest('Test 9 - AI Explanation Evidence Grounding', async () => {
    const insights = [{
      id: 'insight_missing_Rating',
      insightType: 'missing_values',
      severity: 'low',
      column: 'Rating',
      observation: 'Rating has 1 missing value out of 20 rows (5%).',
      whyItMatters: 'Calculations will exclude missing values.',
      evidence: { rowCount: 20, missingCount: 1, missingPercentage: 5 }
    }];

    const exp = await generateInsightExplanation(insights, { forceFallback: true });
    assert.ok(exp.includes('Rating') || exp.includes('missing'));
  });

  // Test 10: Tied Categories Handling (Electronics = 50%, Accessories = 50%)
  await runTest('Test 10 - Tied Categories Representation (Electronics vs Accessories)', () => {
    const tiedDataset = [
      { Category: 'Electronics' }, { Category: 'Electronics' },
      { Category: 'Accessories' }, { Category: 'Accessories' }
    ];
    const res = generateDatasetInsights(tiedDataset, ['Category']);
    const tiedInsight = res.insights.find(i => i.column === 'Category' && i.insightType === 'category_distribution');

    assert.ok(tiedInsight, 'Tied category distribution insight should be generated');
    assert.ok(tiedInsight.observation.includes('equally represented') || tiedInsight.observation.includes('tied'));
    assert.ok(tiedInsight.observation.includes('Electronics'));
    assert.ok(tiedInsight.observation.includes('Accessories'));
    assert.strictEqual(tiedInsight.observation.includes('dominates'), false, 'Tied categories must NOT claim dominance');
  });

  console.log(`\nPHASE 6 TEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
