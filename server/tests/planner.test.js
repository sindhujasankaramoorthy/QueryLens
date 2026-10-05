const assert = require('assert');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { generateAnalysisPlan, heuristicFallbackPlanner } = require('../src/services/llmPlanner');

console.log('--- RUNNING PSA01 PHASE 2 TEST SUITE ---');

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

// Mock Dataset Schema
const sampleSchema = [
  { name: 'region', type: 'categorical' },
  { name: 'product', type: 'categorical' },
  { name: 'profit', type: 'float' },
  { name: 'price', type: 'float' },
  { name: 'sales', type: 'integer' },
  { name: 'sale_date', type: 'date' }
];

const underscoreSchema = [
  { name: 'Order_ID', type: 'integer' },
  { name: 'Order_Date', type: 'date' },
  { name: 'Sales', type: 'float' },
  { name: 'Quantity', type: 'integer' },
  { name: 'Customer_Rating', type: 'float' }
];

(async () => {
  // Test 1: Sum
  await runTest('Test 1 - Simple Sum Question Plan Generation', async () => {
    const result = await generateAnalysisPlan('What is the total profit?', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.measure, 'profit');
    assert.ok(result.plan.operation === 'sum' || result.plan.aggregation === 'sum');
  });

  // Test 2: Average
  await runTest('Test 2 - Average Question Plan Generation', async () => {
    const result = await generateAnalysisPlan('What is the average price?', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.measure, 'price');
    assert.strictEqual(result.plan.aggregation, 'average');
  });

  // Test 3: Group Aggregation
  await runTest('Test 3 - Group Aggregation Plan Generation', async () => {
    const result = await generateAnalysisPlan('Which region has the highest profit?', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.operation, 'group_aggregate');
    assert.strictEqual(result.plan.groupBy, 'region');
    assert.strictEqual(result.plan.measure, 'profit');
    assert.strictEqual(result.plan.sort, 'descending');
    assert.strictEqual(result.plan.limit, 1);
  });

  // Test 4: Top N
  await runTest('Test 4 - Top N Products Question Plan Generation', async () => {
    const result = await generateAnalysisPlan('Show the top 5 products by sales.', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.groupBy, 'product');
    assert.strictEqual(result.plan.measure, 'sales');
    assert.strictEqual(result.plan.limit, 5);
  });

  // Test 5: Date Analysis
  await runTest('Test 5 - Time Series / Date Analysis Plan Generation', async () => {
    const result = await generateAnalysisPlan('Show monthly sales over time.', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.ok(['time_series', 'time_group'].includes(result.plan.operation), `Operation should be time_series or time_group, got '${result.plan.operation}'`);
    assert.strictEqual(result.plan.column, 'sale_date');
    assert.strictEqual(result.plan.timeUnit, 'month');
  });

  // Test 6: Invalid Column / Unanswerable Question
  await runTest('Test 6 - Invalid Column Request (cannot_answer)', async () => {
    const restrictedSchema = [
      { name: 'name', type: 'text' },
      { name: 'age', type: 'integer' },
      { name: 'city', type: 'categorical' }
    ];
    const result = await generateAnalysisPlan('What was the total revenue?', restrictedSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'cannot_answer');
    assert.ok(result.reason.length > 0);
  });

  // Test 7: Ambiguous Question
  await runTest('Test 7 - Ambiguous Question (clarification_required)', async () => {
    const result = await generateAnalysisPlan('What is the best product?', sampleSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'clarification_required');
    assert.ok(result.clarificationQuestion.length > 0);
  });

  // Test 8: Invalid Operation Rejection
  await runTest('Test 8 - Validator Rejects Unsupported Operation', () => {
    const malformedPlan = {
      operation: 'delete_database',
      measure: 'profit'
    };
    const result = validateAnalysisPlan(malformedPlan, sampleSchema);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.status, 'rejected');
    assert.ok(result.reason.includes('Unsupported operation'));
  });

  // Test 9: Nonexistent Column Rejection
  await runTest('Test 9 - Validator Rejects Nonexistent Column', () => {
    const invalidColPlan = {
      operation: 'sum',
      measure: 'fake_nonexistent_column'
    };
    const result = validateAnalysisPlan(invalidColPlan, sampleSchema);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.status, 'rejected');
    assert.ok(result.reason.includes('does not exist'));
  });

  // Test 10: Arbitrary Code Threat Rejection
  await runTest('Test 10 - Validator Rejects Arbitrary Code Execution Threat', () => {
    const threatPlan = {
      operation: 'sum',
      measure: 'profit; eval("process.exit()")'
    };
    const result = validateAnalysisPlan(threatPlan, sampleSchema);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.status, 'rejected');
    assert.ok(result.reason.includes('Forbidden expression'));
  });

  // Regression Tests for Column Name Normalization (Underscores vs Spaces, Capitalization)
  // Test 11: "What is the average customer rating?" -> Customer_Rating
  await runTest('Test 11 - Column Normalization: "What is the average customer rating?"', async () => {
    const result = await generateAnalysisPlan('What is the average customer rating?', underscoreSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.operation, 'average');
    assert.strictEqual(result.plan.measure, 'Customer_Rating');
  });

  // Test 12: "What is the total sales?" -> Sales
  await runTest('Test 12 - Column Normalization: "What is the total sales?"', async () => {
    const result = await generateAnalysisPlan('What is the total sales?', underscoreSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.measure, 'Sales');
  });

  // Test 13: "What is the average quantity sold?" -> Quantity
  await runTest('Test 13 - Column Normalization: "What is the average quantity sold?"', async () => {
    const result = await generateAnalysisPlan('What is the average quantity sold?', underscoreSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.operation, 'average');
    assert.strictEqual(result.plan.measure, 'Quantity');
  });

  // Test 14: "What is the total profit?" -> cannot_answer
  await runTest('Test 14 - Column Normalization: "What is the total profit?" (Nonexistent column -> cannot_answer)', async () => {
    const result = await generateAnalysisPlan('What is the total profit?', underscoreSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'cannot_answer');
  });

  // Test 15: "What is the order date range?" -> Order_Date
  await runTest('Test 15 - Column Normalization: "What is the order date range?"', async () => {
    const result = await generateAnalysisPlan('What is the order date range?', underscoreSchema, { forceFallback: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'validated');
    assert.strictEqual(result.plan.column, 'Order_Date');
  });

  console.log(`\nPHASE 2 TEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
