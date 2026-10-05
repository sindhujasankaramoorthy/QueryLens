const assert = require('assert');
const { executeAnalysisPlan, filterRows } = require('../src/services/analysisEngine');
const { validateAnalysisPlan } = require('../src/services/planValidator');

console.log('--- RUNNING PSA01 PHASE 3 TEST SUITE ---');

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

// Mock dataset rows
const sampleRows = [
  { Order_ID: 1, Product: 'Widget A', Category: 'Tech', Region: 'North', Sales: 100, Quantity: 2, Order_Date: '2025-01-15' },
  { Order_ID: 2, Product: 'Widget B', Category: 'Tech', Region: 'South', Sales: 250, Quantity: 5, Order_Date: '2025-01-20' },
  { Order_ID: 3, Product: 'Widget A', Category: 'Tech', Region: 'North', Sales: 290, Quantity: 4, Order_Date: '2025-02-05' },
  { Order_ID: 4, Product: 'Gadget X', Category: 'Home', Region: 'West', Sales: 120, Quantity: 1, Order_Date: '2025-02-12' },
  { Order_ID: 5, Product: 'Gadget Y', Category: 'Home', Region: 'North', Sales: 150, Quantity: 3, Order_Date: '2025-03-01' },
  { Order_ID: 6, Product: 'Gadget Y', Category: 'Home', Region: 'East', Sales: null, Quantity: 1, Order_Date: '2025-03-02' }
];

(async () => {
  // Test 1: Sum
  await runTest('Test 1 - Deterministic Sum Calculation', () => {
    const plan = { operation: 'sum', measure: 'Sales' };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result[0].Sales, 910);
    assert.strictEqual(res.metadata.missingValuesIgnored, 1);
  });

  // Test 2: Average
  await runTest('Test 2 - Deterministic Average Calculation', () => {
    const plan = { operation: 'average', measure: 'Sales' };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result[0].Sales, 182);
  });

  // Test 3: Median
  await runTest('Test 3 - Deterministic Median Calculation (Odd & Even)', () => {
    const oddRows = [{ Sales: 100 }, { Sales: 250 }, { Sales: 150 }];
    const resOdd = executeAnalysisPlan({ operation: 'median', measure: 'Sales' }, oddRows);
    assert.strictEqual(resOdd.result[0].Sales, 150);

    const evenRows = [{ Sales: 100 }, { Sales: 250 }, { Sales: 150 }, { Sales: 300 }];
    const resEven = executeAnalysisPlan({ operation: 'median', measure: 'Sales' }, evenRows);
    assert.strictEqual(resEven.result[0].Sales, 200);
  });

  // Test 4: Minimum
  await runTest('Test 4 - Deterministic Minimum Calculation', () => {
    const plan = { operation: 'min', measure: 'Sales' };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.result[0].Sales, 100);
  });

  // Test 5: Maximum
  await runTest('Test 5 - Deterministic Maximum Calculation', () => {
    const plan = { operation: 'max', measure: 'Sales' };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.result[0].Sales, 290);
  });

  // Test 6: Group Aggregate
  await runTest('Test 6 - Deterministic Group Aggregate Calculation', () => {
    const plan = {
      operation: 'group_aggregate',
      groupBy: 'Region',
      measure: 'Sales',
      aggregation: 'sum',
      sort: 'descending'
    };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result[0].Region, 'North');
    assert.strictEqual(res.result[0].Sales_sum, 540);
    assert.strictEqual(res.result[1].Region, 'South');
    assert.strictEqual(res.result[1].Sales_sum, 250);
  });

  // Test 7: Top N
  await runTest('Test 7 - Top N Query Calculation', () => {
    const plan = {
      operation: 'top_n',
      groupBy: 'Product',
      measure: 'Sales',
      aggregation: 'sum',
      limit: 2
    };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.result.length, 2);
    assert.strictEqual(res.result[0].Product, 'Widget A');
    assert.strictEqual(res.result[0].Sales_sum, 390);
    assert.strictEqual(res.result[1].Product, 'Widget B');
  });

  // Test 8: Bottom N
  await runTest('Test 8 - Bottom N Query Calculation', () => {
    const plan = {
      operation: 'bottom_n',
      groupBy: 'Product',
      measure: 'Sales',
      aggregation: 'sum',
      limit: 2
    };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.result.length, 2);
    assert.strictEqual(res.result[0].Product, 'Gadget X');
    assert.strictEqual(res.result[0].Sales_sum, 120);
    assert.strictEqual(res.result[1].Product, 'Gadget Y');
  });

  // Test 9: Filters
  await runTest('Test 9 - Filter Operators (=, >, !=)', () => {
    const filterEqual = filterRows(sampleRows, [{ column: 'Region', operator: '=', value: 'North' }]);
    assert.strictEqual(filterEqual.length, 3);

    const filterGreater = filterRows(sampleRows, [{ column: 'Sales', operator: '>', value: 200 }]);
    assert.strictEqual(filterGreater.length, 2);

    const filterNotEqual = filterRows(sampleRows, [{ column: 'Category', operator: '!=', value: 'Tech' }]);
    assert.strictEqual(filterNotEqual.length, 3);
  });

  // Test 10: Date Grouping
  await runTest('Test 10 - Time Grouping by Month & Chronological Sort', () => {
    const plan = {
      operation: 'time_group',
      column: 'Order_Date',
      measure: 'Sales',
      aggregation: 'sum',
      timeUnit: 'month'
    };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.result.length, 3);
    assert.strictEqual(res.result[0].Order_Date, '2025-01');
    assert.strictEqual(res.result[0].Sales_sum, 350);
    assert.strictEqual(res.result[1].Order_Date, '2025-02');
    assert.strictEqual(res.result[1].Sales_sum, 410);
    assert.strictEqual(res.result[2].Order_Date, '2025-03');
    assert.strictEqual(res.result[2].Sales_sum, 150);
  });

  // Test 11: Missing Values Metadata
  await runTest('Test 11 - Missing Values Handling & Explicit Metadata', () => {
    const plan = { operation: 'sum', measure: 'Sales' };
    const res = executeAnalysisPlan(plan, sampleRows);
    assert.strictEqual(res.metadata.rowsAnalyzed, 6);
    assert.strictEqual(res.metadata.missingValuesIgnored, 1);
  });

  // Test 12: Invalid Plan Rejection
  await runTest('Test 12 - Plan Validation Rejects Invalid Operations', () => {
    const schema = [
      { name: 'Product', type: 'text' },
      { name: 'Sales', type: 'float' }
    ];
    const invalidPlan = { operation: 'sum', measure: 'Nonexistent_Column' };
    const validation = validateAnalysisPlan(invalidPlan, schema);
    assert.strictEqual(validation.isValid, false);
    assert.strictEqual(validation.status, 'rejected');
  });

  // Test 13: Security Guard Against Code Threat
  await runTest('Test 13 - Security Threat Input Rejection', () => {
    const schema = [{ name: 'Sales', type: 'float' }];
    const threatPlan = { operation: 'sum', measure: 'Sales; eval("process.exit()")' };
    const validation = validateAnalysisPlan(threatPlan, schema);
    assert.strictEqual(validation.isValid, false);
    assert.strictEqual(validation.status, 'rejected');
  });

  // Test 14: Top N Measure Selection
  await runTest('Test 14 - Top N Measure Selection (Sales vs Order_ID)', () => {
    const multiNumDataset = [
      { Order_ID: 1001, Product: 'Laptop', Sales: 180000, Quantity: 10 },
      { Order_ID: 1005, Product: 'Laptop', Sales: 200000, Quantity: 8 },
      { Order_ID: 1002, Product: 'Phone', Sales: 49000, Quantity: 5 },
      { Order_ID: 1006, Product: 'Phone', Sales: 50000, Quantity: 4 },
      { Order_ID: 1009, Product: 'Phone', Sales: 48000, Quantity: 3 },
      { Order_ID: 1014, Product: 'Phone', Sales: 50000, Quantity: 2 },
      { Order_ID: 1019, Product: 'Phone', Sales: 50000, Quantity: 1 },
      { Order_ID: 1003, Product: 'Headphones', Sales: 18000, Quantity: 20 },
      { Order_ID: 1004, Product: 'Headphones', Sales: 18000, Quantity: 15 },
      { Order_ID: 1008, Product: 'Headphones', Sales: 18000, Quantity: 10 }
    ];

    const plan = {
      operation: 'top_n',
      groupBy: 'Product',
      measure: 'Sales',
      aggregation: 'sum',
      sort: 'descending',
      limit: 3
    };

    const res = executeAnalysisPlan(plan, multiNumDataset);
    assert.strictEqual(res.result.length, 3);
    assert.strictEqual(res.result[0].Product, 'Laptop');
    assert.strictEqual(res.result[0].Sales_sum, 380000);
    assert.strictEqual(res.result[1].Product, 'Phone');
    assert.strictEqual(res.result[1].Sales_sum, 247000);
    assert.strictEqual(res.result[2].Product, 'Headphones');
    assert.strictEqual(res.result[2].Sales_sum, 54000);
  });

  // Test 15: Quantity Measure Selection
  await runTest('Test 15 - Top N Measure Selection (Quantity vs Sales)', () => {
    const multiNumDataset = [
      { Order_ID: 1001, Product: 'Laptop', Sales: 180000, Quantity: 10 },
      { Order_ID: 1005, Product: 'Laptop', Sales: 200000, Quantity: 8 },
      { Order_ID: 1002, Product: 'Phone', Sales: 49000, Quantity: 5 },
      { Order_ID: 1006, Product: 'Phone', Sales: 50000, Quantity: 4 },
      { Order_ID: 1009, Product: 'Phone', Sales: 48000, Quantity: 3 },
      { Order_ID: 1014, Product: 'Phone', Sales: 50000, Quantity: 2 },
      { Order_ID: 1019, Product: 'Phone', Sales: 50000, Quantity: 1 },
      { Order_ID: 1003, Product: 'Headphones', Sales: 18000, Quantity: 20 },
      { Order_ID: 1004, Product: 'Headphones', Sales: 18000, Quantity: 15 },
      { Order_ID: 1008, Product: 'Headphones', Sales: 18000, Quantity: 10 }
    ];

    const plan = {
      operation: 'top_n',
      groupBy: 'Product',
      measure: 'Quantity',
      aggregation: 'sum',
      sort: 'descending',
      limit: 3
    };

    const res = executeAnalysisPlan(plan, multiNumDataset);
    assert.strictEqual(res.result.length, 3);
    assert.strictEqual(res.result[0].Product, 'Headphones');
    assert.strictEqual(res.result[0].Quantity_sum, 45);
    assert.strictEqual(res.result[1].Product, 'Laptop');
    assert.strictEqual(res.result[1].Quantity_sum, 18);
    assert.strictEqual(res.result[2].Product, 'Phone');
    assert.strictEqual(res.result[2].Quantity_sum, 15);
  });

  // Test 16: Monthly Time Grouping (Sales)
  await runTest('Test 16 - Monthly Time Grouping Execution (Sales)', () => {
    const monthlyDataset = [
      { Order_Date: '2025-01-15', Sales: 132000, Quantity: 12 },
      { Order_Date: '2025-02-10', Sales: 133000, Quantity: 15 },
      { Order_Date: '2025-03-05', Sales: 154000, Quantity: 20 },
      { Order_Date: '2025-04-20', Sales: 140000, Quantity: 18 },
      { Order_Date: '2025-05-18', Sales: 28000, Quantity: 5 },
      { Order_Date: '2025-06-30', Sales: 136000, Quantity: 14 }
    ];

    const plan = {
      operation: 'time_group',
      column: 'Order_Date',
      measure: 'Sales',
      aggregation: 'sum',
      timeUnit: 'month'
    };

    const res = executeAnalysisPlan(plan, monthlyDataset);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result.length, 6);
    assert.strictEqual(res.result[0].Order_Date, '2025-01');
    assert.strictEqual(res.result[0].Sales_sum, 132000);
    assert.strictEqual(res.result[1].Order_Date, '2025-02');
    assert.strictEqual(res.result[1].Sales_sum, 133000);
    assert.strictEqual(res.result[2].Order_Date, '2025-03');
    assert.strictEqual(res.result[2].Sales_sum, 154000);
    assert.strictEqual(res.result[3].Order_Date, '2025-04');
    assert.strictEqual(res.result[3].Sales_sum, 140000);
    assert.strictEqual(res.result[4].Order_Date, '2025-05');
    assert.strictEqual(res.result[4].Sales_sum, 28000);
    assert.strictEqual(res.result[5].Order_Date, '2025-06');
    assert.strictEqual(res.result[5].Sales_sum, 136000);
  });

  // Test 17: Monthly Time Grouping (Quantity)
  await runTest('Test 17 - Monthly Time Grouping Measure Selection (Quantity vs Sales)', () => {
    const monthlyDataset = [
      { Order_Date: '2025-01-15', Sales: 132000, Quantity: 12 },
      { Order_Date: '2025-02-10', Sales: 133000, Quantity: 15 },
      { Order_Date: '2025-03-05', Sales: 154000, Quantity: 20 },
      { Order_Date: '2025-04-20', Sales: 140000, Quantity: 18 },
      { Order_Date: '2025-05-18', Sales: 28000, Quantity: 5 },
      { Order_Date: '2025-06-30', Sales: 136000, Quantity: 14 }
    ];

    const plan = {
      operation: 'time_group',
      column: 'Order_Date',
      measure: 'Quantity',
      aggregation: 'sum',
      timeUnit: 'month'
    };

    const res = executeAnalysisPlan(plan, monthlyDataset);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result.length, 6);
    assert.strictEqual(res.result[0].Quantity_sum, 12);
    assert.strictEqual(res.result[1].Quantity_sum, 15);
    assert.strictEqual(res.result[2].Quantity_sum, 20);
    assert.strictEqual(res.result[3].Quantity_sum, 18);
    assert.strictEqual(res.result[4].Quantity_sum, 5);
    assert.strictEqual(res.result[5].Quantity_sum, 14);
  });

  // Test 18: Heuristic Planner Test - Query "Show total sales by month."
  await runTest('Test 18 - Heuristic Planner generates time_group plan for "Show total sales by month."', async () => {
    const { generateAnalysisPlan } = require('../src/services/llmPlanner');
    const schema = [
      { name: 'Order_Date', type: 'date' },
      { name: 'Sales', type: 'float' },
      { name: 'Quantity', type: 'integer' }
    ];

    const validation = await generateAnalysisPlan('Show total sales by month.', schema, { forceFallback: true });
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.status, 'validated');
    assert.strictEqual(validation.plan.operation, 'time_group');
    assert.strictEqual(validation.plan.column, 'Order_Date');
    assert.strictEqual(validation.plan.measure, 'Sales');
    assert.strictEqual(validation.plan.timeUnit, 'month');
  });

  // Test 19: Customer_Rating Average Execution ignoring 1 missing value out of 20 rows
  await runTest('Test 19 - Customer_Rating Average Calculation (Ignoring 1 missing value)', () => {
    const rows20 = [];
    for (let i = 1; i <= 19; i++) {
      rows20.push({ Order_ID: i, Customer_Rating: 4.0 });
    }
    rows20.push({ Order_ID: 20, Customer_Rating: null }); // 1 missing value

    const plan = { operation: 'average', measure: 'Customer_Rating' };
    const res = executeAnalysisPlan(plan, rows20);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result[0].Customer_Rating, 4.0); // 19 * 4.0 / 19 = 4.0
    assert.strictEqual(res.metadata.rowsAnalyzed, 20);
    assert.strictEqual(res.metadata.missingValuesIgnored, 1);
  });

  console.log(`\nPHASE 3 TEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
