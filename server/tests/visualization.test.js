const assert = require('assert');
const { generateAnalysisPlan } = require('../src/services/llmPlanner');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { determineVisualization } = require('../src/services/chartSelector');

console.log('--- RUNNING PSA01 PHASE 4 TEST SUITE ---');

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

// Dataset 1: Standard E-Commerce Test Dataset
const ecomSchema = [
  { name: 'Order_ID', type: 'integer' },
  { name: 'Order_Date', type: 'date' },
  { name: 'Product', type: 'categorical' },
  { name: 'Category', type: 'categorical' },
  { name: 'Region', type: 'categorical' },
  { name: 'Sales', type: 'float' },
  { name: 'Quantity', type: 'integer' }
];

const ecomDataset = [
  { Order_ID: 1001, Order_Date: '2025-01-15', Product: 'Laptop', Category: 'Tech', Region: 'North', Sales: 132000, Quantity: 10 },
  { Order_ID: 1002, Order_Date: '2025-02-10', Product: 'Phone', Category: 'Tech', Region: 'North', Sales: 86000, Quantity: 5 },
  { Order_ID: 1003, Order_Date: '2025-02-12', Product: 'Headphones', Category: 'Tech', Region: 'South', Sales: 47000, Quantity: 20 },
  { Order_ID: 1004, Order_Date: '2025-03-05', Product: 'Laptop', Category: 'Tech', Region: 'South', Sales: 154000, Quantity: 8 },
  { Order_ID: 1005, Order_Date: '2025-04-20', Product: 'Phone', Category: 'Tech', Region: 'East', Sales: 140000, Quantity: 18 },
  { Order_ID: 1006, Order_Date: '2025-05-18', Product: 'Headphones', Category: 'Tech', Region: 'East', Sales: 22500, Quantity: 5 },
  { Order_ID: 1007, Order_Date: '2025-06-30', Product: 'Laptop', Category: 'Tech', Region: 'West', Sales: 94000, Quantity: 5 },
  { Order_ID: 1008, Order_Date: '2025-06-30', Product: 'Phone', Category: 'Tech', Region: 'West', Sales: 47500, Quantity: 2 }
];

(async () => {
  // Test 1: Scalar ("What is the total sales?")
  await runTest('Test 1 - Scalar Presentation: "What is the total sales?"', async () => {
    const planRes = await generateAnalysisPlan('What is the total sales?', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, ecomDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result[0].Sales, 723000);
    assert.strictEqual(vizRes.chartType, 'none');
    assert.strictEqual(vizRes.shouldRenderChart, false);
    assert.strictEqual(vizRes.isScalar, true);
  });

  // Test 2: Average ("What is the average quantity sold?")
  await runTest('Test 2 - Average Scalar Presentation: "What is the average quantity sold?"', async () => {
    const qtyDataset = [
      { Quantity: 10 },
      { Quantity: 15 },
      { Quantity: 20 },
      { Quantity: 11.6 }
    ]; // sum = 56.6, avg = 14.15

    const planRes = await generateAnalysisPlan('What is the average quantity sold?', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, qtyDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result[0].Quantity, 14.15);
    assert.strictEqual(vizRes.chartType, 'none');
    assert.strictEqual(vizRes.shouldRenderChart, false);
    assert.strictEqual(vizRes.isScalar, true);
  });

  // Test 3: Group Aggregation ("Which region has the highest total sales?")
  await runTest('Test 3 - Group Aggregation Visualization: "Which region has the highest total sales?"', async () => {
    const planRes = await generateAnalysisPlan('Which region has the highest total sales?', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, ecomDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result[0].Region, 'North'); // 132000 + 86000 = 218000
    assert.strictEqual(execRes.result[0].Sales_sum, 218000);
    assert.strictEqual(vizRes.chartType, 'bar');
    assert.strictEqual(vizRes.shouldRenderChart, true);
    assert.strictEqual(vizRes.xKey, 'Region');
    assert.strictEqual(vizRes.yKey, 'Sales_sum');
  });

  // Test 4: Top N ("Show the top 3 products by sales.")
  await runTest('Test 4 - Top N Visualization: "Show the top 3 products by sales."', async () => {
    const multiProductDataset = [
      { Product: 'Laptop', Sales: 180000 },
      { Product: 'Laptop', Sales: 200000 },
      { Product: 'Phone', Sales: 120000 },
      { Product: 'Phone', Sales: 127000 },
      { Product: 'Headphones', Sales: 54000 }
    ];

    const planRes = await generateAnalysisPlan('Show the top 3 products by sales.', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, multiProductDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 3);
    assert.strictEqual(execRes.result[0].Product, 'Laptop');
    assert.strictEqual(execRes.result[0].Sales_sum, 380000);
    assert.strictEqual(execRes.result[1].Product, 'Phone');
    assert.strictEqual(execRes.result[1].Sales_sum, 247000);
    assert.strictEqual(execRes.result[2].Product, 'Headphones');
    assert.strictEqual(execRes.result[2].Sales_sum, 54000);

    assert.strictEqual(vizRes.chartType, 'bar');
    assert.strictEqual(vizRes.shouldRenderChart, true);
    assert.strictEqual(vizRes.xKey, 'Product');
    assert.strictEqual(vizRes.yKey, 'Sales_sum');
  });

  // Test 5: Time Series ("Show total sales by month.")
  await runTest('Test 5 - Time Series Visualization: "Show total sales by month."', async () => {
    const monthlyDataset = [
      { Order_Date: '2025-01-15', Sales: 132000 },
      { Order_Date: '2025-02-10', Sales: 133000 },
      { Order_Date: '2025-03-05', Sales: 154000 },
      { Order_Date: '2025-04-20', Sales: 140000 },
      { Order_Date: '2025-05-18', Sales: 28000 },
      { Order_Date: '2025-06-30', Sales: 136000 }
    ];

    const planRes = await generateAnalysisPlan('Show total sales by month.', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, monthlyDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 6);
    assert.strictEqual(execRes.result[0].Order_Date, '2025-01');
    assert.strictEqual(execRes.result[0].Sales_sum, 132000);
    assert.strictEqual(execRes.result[1].Order_Date, '2025-02');
    assert.strictEqual(execRes.result[1].Sales_sum, 133000);
    assert.strictEqual(execRes.result[2].Order_Date, '2025-03');
    assert.strictEqual(execRes.result[2].Sales_sum, 154000);
    assert.strictEqual(execRes.result[3].Order_Date, '2025-04');
    assert.strictEqual(execRes.result[3].Sales_sum, 140000);
    assert.strictEqual(execRes.result[4].Order_Date, '2025-05');
    assert.strictEqual(execRes.result[4].Sales_sum, 28000);
    assert.strictEqual(execRes.result[5].Order_Date, '2025-06');
    assert.strictEqual(execRes.result[5].Sales_sum, 136000);

    assert.strictEqual(vizRes.chartType, 'line');
    assert.strictEqual(vizRes.shouldRenderChart, true);
    assert.strictEqual(vizRes.xKey, 'Order_Date');
    assert.strictEqual(vizRes.yKey, 'Sales_sum');
  });

  // Test 6: Generic Schema Support (Arbitrary Department + Revenue dataset)
  await runTest('Test 6 - Generic Schema Support (Department + Revenue)', async () => {
    const deptSchema = [
      { name: 'Department', type: 'categorical' },
      { name: 'Revenue', type: 'float' }
    ];
    const deptDataset = [
      { Department: 'Engineering', Revenue: 500000 },
      { Department: 'Marketing', Revenue: 350000 },
      { Department: 'Sales', Revenue: 620000 }
    ];

    const planRes = await generateAnalysisPlan('Which Department generated highest Revenue?', deptSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, deptDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(vizRes.chartType, 'bar');
    assert.strictEqual(vizRes.shouldRenderChart, true);
    assert.strictEqual(vizRes.xKey, 'Department');
    assert.strictEqual(vizRes.yKey, 'Revenue_sum');
    assert.strictEqual(execRes.result[0].Department, 'Sales');
    assert.strictEqual(execRes.result[0].Revenue_sum, 620000);
  });

  // Test 7: No Fabricated Data
  await runTest('Test 7 - Data Safety: Chart Data strictly matches Phase 3 result', async () => {
    const planRes = await generateAnalysisPlan('Show monthly sales over time.', ecomSchema, { forceFallback: true });
    const execRes = executeAnalysisPlan(planRes.plan, ecomDataset);
    const vizRes = determineVisualization(execRes, planRes.plan);

    // Verify chartData reference identity or deep strict equality
    assert.strictEqual(vizRes.chartData, execRes.result);
    assert.deepStrictEqual(vizRes.chartData, execRes.result);
  });

  console.log(`\nPHASE 4 TEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
