/**
 * Phase 9 — Statistically Reliable Trend & Time-Series Analysis Test Suite
 * Tests plan generation, plan validation, deterministic linear regression calculation (slope, relative slope, R2),
 * period-over-period growth, trend direction classification, grouped time series, edge cases, and safety guards.
 */

const { generateAnalysisPlan } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');

// Sample dataset with Order_Date, Sales, Quantity, Customer_Rating, Region, Product, Order_ID
const sampleSchema = [
  { name: 'Order_ID', type: 'integer', semanticType: 'identifier' },
  { name: 'Order_Date', type: 'date', semanticType: 'datetime' },
  { name: 'Sales', type: 'integer', semanticType: 'measure' },
  { name: 'Quantity', type: 'integer', semanticType: 'measure' },
  { name: 'Customer_Rating', type: 'float', semanticType: 'measure' },
  { name: 'Region', type: 'categorical', semanticType: 'categorical' },
  { name: 'Product', type: 'categorical', semanticType: 'categorical' }
];

const sampleRows = [
  { Order_ID: 101, Order_Date: '2026-01-15', Sales: 100000, Quantity: 10, Customer_Rating: 4.5, Region: 'North', Product: 'Laptop' },
  { Order_ID: 102, Order_Date: '2026-01-20', Sales: 50000, Quantity: 5, Customer_Rating: 4.0, Region: 'South', Product: 'Mouse' },
  { Order_ID: 103, Order_Date: '2026-02-10', Sales: 120000, Quantity: 12, Customer_Rating: 4.8, Region: 'North', Product: 'Laptop' },
  { Order_ID: 104, Order_Date: '2026-02-22', Sales: 60000, Quantity: 6, Customer_Rating: 4.2, Region: 'South', Product: 'Keyboard' },
  { Order_ID: 105, Order_Date: '2026-03-05', Sales: 115000, Quantity: 11, Customer_Rating: 4.6, Region: 'North', Product: 'Monitor' },
  { Order_ID: 106, Order_Date: '2026-03-18', Sales: 70000, Quantity: 7, Customer_Rating: 4.3, Region: 'South', Product: 'Laptop' }
];

async function runTimeSeriesTests() {
  console.log('\n--- RUNNING PSA01 PHASE 9 TIME-SERIES TEST SUITE ---');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`✕ FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  // Test 1: "Show monthly Sales over time."
  {
    const q = 'Show monthly Sales over time.';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.isValid && validation.status === 'validated', 'Test 1 - Plan valid for "Show monthly Sales over time."');
    assert(validation.plan.operation === 'time_series', 'Test 1 - Operation is time_series');
    assert(validation.plan.granularity === 'MONTH', 'Test 1 - Granularity is MONTH');

    const result = executeAnalysisPlan(validation.plan, sampleRows);
    assert(result.status === 'success', 'Test 1 - Engine executes successfully');
    assert(result.result.length === 3, 'Test 1 - Result has 3 monthly periods (2026-01, 2026-02, 2026-03)');
    assert(result.result[0]['2026-01'] !== undefined || result.result[0]['Order_Date'] === '2026-01', 'Test 1 - First month is 2026-01');
    assert(result.result[0]['Sales'] === 150000, 'Test 1 - Jan Sales = 150,000');
    assert(result.result[1]['Sales'] === 180000, 'Test 1 - Feb Sales = 180,000');
  }

  // Test 2: "How did Sales change over time?"
  {
    const q = 'How did Sales change over time?';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.isValid && validation.plan.operation === 'time_series', 'Test 2 - Plan is time_series for general change question');

    const result = executeAnalysisPlan(validation.plan, sampleRows);
    assert(result.result.length === 3, 'Test 2 - Aggregates chronologically over 3 months');
    assert(typeof result.metadata.slope === 'number', 'Test 2 - Includes regression slope in metadata');
    assert(typeof result.metadata.r2 === 'number', 'Test 2 - Includes R2 coefficient in metadata');
  }

  // Test 3: "Show yearly Sales."
  {
    const q = 'Show yearly Sales.';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.isValid && validation.plan.granularity === 'YEAR', 'Test 3 - Granularity inferred as YEAR');

    const result = executeAnalysisPlan(validation.plan, sampleRows);
    assert(result.result.length === 1, 'Test 3 - Result has 1 yearly period (2026)');
    assert(result.result[0]['Sales'] === 515000, 'Test 3 - 2026 Total Sales = 515,000');
    assert(result.metadata.trendDirection === 'Insufficient Data', 'Test 3 - 1 period evaluates to Insufficient Data');
  }

  // Test 4: "Show monthly Quantity over time."
  {
    const q = 'Show monthly Quantity over time.';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.isValid && validation.plan.measure === 'Quantity', 'Test 4 - Measure is Quantity');

    const result = executeAnalysisPlan(validation.plan, sampleRows);
    assert(result.result[0]['Quantity'] === 15, 'Test 4 - Jan Quantity = 15');
    assert(result.result[1]['Quantity'] === 18, 'Test 4 - Feb Quantity = 18');
  }

  // Test 5: "Show monthly Sales by Region."
  {
    const q = 'Show monthly Sales by Region.';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.isValid && validation.plan.groupBy === 'Region', 'Test 5 - GroupBy is Region');

    const result = executeAnalysisPlan(validation.plan, sampleRows);
    assert(result.result.length === 6, 'Test 5 - Grouped result has 6 rows (3 months x 2 regions)');
    assert(result.metadata.groupedSeries !== null, 'Test 5 - Metadata contains groupedSeries breakdown');
    assert(result.metadata.groupedSeries['North'].trendDirection !== undefined, 'Test 5 - Independent trend calculated for North region');
    assert(result.metadata.groupedSeries['South'].trendDirection !== undefined, 'Test 5 - Independent trend calculated for South region');
  }

  // Test 6: Growth % & Statistical Regression Metrics
  {
    const q = 'What was the monthly Sales growth?';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    const result = executeAnalysisPlan(validation.plan, sampleRows);

    assert(result.result[0]['Growth (%)'] === '—', 'Test 6 - First period growth is —');
    assert(result.result[1]['Growth (%)'] === 20, 'Test 6 - Feb Sales growth is 20%');
    assert(result.metadata.slope > 0, 'Test 6 - Slope is positive');
    assert(result.metadata.r2 >= 0 && result.metadata.r2 <= 1, 'Test 6 - R2 is within [0, 1]');
  }

  // Test 7: Fluctuating Series Regression Fit Test (No first vs last trap)
  {
    const fluctuatingRows = [
      { Order_Date: '2026-01-01', Sales: 100 },
      { Order_Date: '2026-02-01', Sales: 180 },
      { Order_Date: '2026-03-01', Sales: 90 },
      { Order_Date: '2026-04-01', Sales: 170 },
      { Order_Date: '2026-05-01', Sales: 110 },
      { Order_Date: '2026-06-01', Sales: 160 }
    ];

    const plan = { operation: 'time_series', date_column: 'Order_Date', measure: 'Sales', granularity: 'MONTH' };
    const result = executeAnalysisPlan(plan, fluctuatingRows);

    // Linear regression slope for x=[1..6], y=[100, 180, 90, 170, 110, 160] -> m = +1.43, meanY = 135
    // Relative slope = 1.43 / 135 = +1.06% (> 0.5% threshold -> Increasing)
    // R2 = 0.01 (Low fit due to heavy fluctuation)
    assert(result.metadata.slope === 4.86, `Test 7 - Slope is 4.86 (got ${result.metadata.slope})`);
    assert(result.metadata.relativeSlope === 3.6, `Test 7 - Relative slope is +3.6% (got ${result.metadata.relativeSlope})`);
    assert(result.metadata.r2 === 0.05, `Test 7 - R2 is 0.05 (got ${result.metadata.r2})`);
    assert(result.metadata.trendDirection === 'Increasing', 'Test 7 - Classified as Increasing based on slope');
  }

  // Test 8: All Identical Values -> Stable Trend
  {
    const identicalRows = [
      { Order_Date: '2026-01-01', Sales: 100 },
      { Order_Date: '2026-02-01', Sales: 100 },
      { Order_Date: '2026-03-01', Sales: 100 }
    ];
    const plan = { operation: 'time_series', date_column: 'Order_Date', measure: 'Sales', granularity: 'MONTH' };
    const result = executeAnalysisPlan(plan, identicalRows);

    assert(result.metadata.slope === 0, 'Test 8 - Slope is 0 for identical values');
    assert(result.metadata.relativeSlope === 0, 'Test 8 - Relative slope is 0%');
    assert(result.metadata.r2 === 1.0, 'Test 8 - R2 is 1.0 for zero variance horizontal fit');
    assert(result.metadata.trendDirection === 'Stable', 'Test 8 - Classified as Stable');
  }

  // Test 9: Identifier Guard: "Show Order_ID trend over time."
  {
    const q = 'Show Order_ID trend over time.';
    const validation = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assert(validation.status === 'cannot_answer', 'Test 9 - Rejected Order_ID trend request');
    assert(validation.reason.includes('identifier'), 'Test 9 - Explanation states Order_ID is an identifier column');
  }

  // Test 10: Missing Date Column Guard
  {
    const schemaNoDate = [
      { name: 'Order_ID', type: 'integer', semanticType: 'identifier' },
      { name: 'Sales', type: 'integer', semanticType: 'measure' },
      { name: 'Region', type: 'categorical', semanticType: 'categorical' }
    ];

    const q = 'Show Sales over time.';
    const validation = await generateAnalysisPlan(q, schemaNoDate, { forceFallback: true });
    assert(validation.status === 'cannot_answer', 'Test 10 - Rejects time analysis when no date column exists');
    assert(validation.reason.includes('usable date/time column'), 'Test 10 - Explanation states dataset lacks date/time column');
  }

  // Test 11: AI Explanation grounding and Low R2 interpretation
  {
    const fluctuatingRows = [
      { Order_Date: '2026-01-01', Sales: 100 },
      { Order_Date: '2026-02-01', Sales: 180 },
      { Order_Date: '2026-03-01', Sales: 90 },
      { Order_Date: '2026-04-01', Sales: 170 },
      { Order_Date: '2026-05-01', Sales: 110 },
      { Order_Date: '2026-06-01', Sales: 160 }
    ];

    const plan = { operation: 'time_series', date_column: 'Order_Date', measure: 'Sales', granularity: 'MONTH' };
    const engineRes = executeAnalysisPlan(plan, fluctuatingRows);
    const explanation = await generateExplanation({ ...engineRes, question: 'Show monthly Sales trend.' }, { forceFallback: true });

    assert(explanation.includes('Sales shows an overall Increasing trend'), 'Test 11 - Explanation mentions Increasing trend');
    assert(explanation.includes('R²'), 'Test 11 - Explanation mentions R² fit strength');
    assert(explanation.includes('0.05'), 'Test 11 - Explanation includes exact calculated R² figure (0.05)');
  }

  console.log(`\nPHASE 9 TIME-SERIES TEST RESULTS: ${passedCount}/${totalCount} tests passed.\n`);
}

if (require.main === module) {
  runTimeSeriesTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTimeSeriesTests };
