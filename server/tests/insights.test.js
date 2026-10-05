const assert = require('assert');
const { heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');
const { profileDataset } = require('../src/services/profiler');

async function runInsightsTests() {
  console.log('\n--- RUNNING PSA01 PHASE 13 INSIGHTS & ROOT-CAUSE TEST SUITE ---');
  let passedCount = 0;
  let totalCount = 0;

  function assertTrue(cond, msg) {
    totalCount++;
    if (cond) {
      console.log(`✓ PASS: ${msg}`);
      passedCount++;
    } else {
      console.error(`✕ FAIL: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }

  const mockDataset = [
    { Order_ID: 1001, Order_Date: '2026-09-15', Region: 'South', Category: 'Electronics', Sales: 500000, Quantity: 50, Customer_Rating: 4.5 },
    { Order_ID: 1002, Order_Date: '2026-09-15', Region: 'North', Category: 'Electronics', Sales: 400000, Quantity: 40, Customer_Rating: 4.6 },
    { Order_ID: 1003, Order_Date: '2026-09-15', Region: 'East', Category: 'Furniture', Sales: 300000, Quantity: 30, Customer_Rating: 4.4 },

    { Order_ID: 1004, Order_Date: '2026-10-15', Region: 'South', Category: 'Electronics', Sales: 200000, Quantity: 20, Customer_Rating: 3.5 }, // Dropped by 300k
    { Order_ID: 1005, Order_Date: '2026-10-15', Region: 'North', Category: 'Electronics', Sales: 380000, Quantity: 38, Customer_Rating: 4.5 }, // Dropped by 20k
    { Order_ID: 1006, Order_Date: '2026-10-15', Region: 'East', Category: 'Furniture', Sales: 310000, Quantity: 31, Customer_Rating: 4.5 }   // Grew by 10k
  ];

  const profile = profileDataset(mockDataset);

  function getPlan(question) {
    const res = heuristicFallbackPlanner(question, profile.columns);
    return res.plan || res;
  }

  // TEST 1
  {
    const question = 'Why did sales decrease in October 2026?';
    const plan = getPlan(question);

    assertTrue(plan.operation === 'insight_analysis', 'TEST 1 - Operation is insight_analysis');
    assertTrue(plan.target_measure === 'Sales', 'TEST 1 - Target measure is Sales');
    assertTrue(plan.target_period === '2026-10', 'TEST 1 - Target period is 2026-10');

    const validation = validateAnalysisPlan(plan, profile.columns);
    assertTrue(validation.isValid === true, 'TEST 1 - Validation is valid');

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    assertTrue(execResult.status === 'success', 'TEST 1 - Engine execution success');
    assertTrue(execResult.operation === 'insight_analysis', 'TEST 1 - Result operation is insight_analysis');
    assertTrue(execResult.metadata.targetMeasure === 'Sales', 'TEST 1 - Metadata target measure is Sales');
    assertTrue(execResult.metadata.targetPeriod === '2026-10', 'TEST 1 - Metadata target period is 2026-10');
    assertTrue(execResult.metadata.comparisonPeriod === '2026-09', 'TEST 1 - Baseline comparison period resolved to 2026-09');
    assertTrue(execResult.metadata.absoluteChange === -310000, 'TEST 1 - Net change calculated as -310,000');
    assertTrue(execResult.metadata.direction === 'decrease', 'TEST 1 - Direction is decrease');
    assertTrue(execResult.metadata.topContributors.length > 0, 'TEST 1 - Top contributors generated');

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    assertTrue(explanation.includes('Sales'), 'TEST 1 - Explanation mentions Sales');
    assertTrue(!explanation.includes('caused'), 'TEST 1 - Explanation adheres to non-causal rules');
  }

  // TEST 2
  {
    const question = 'What factors contributed to the increase in sales?';
    const plan = getPlan(question);

    assertTrue(plan.operation === 'insight_analysis', 'TEST 2 - Operation is insight_analysis');
    assertTrue(plan.target_measure === 'Sales', 'TEST 2 - Target measure is Sales');

    const validation = validateAnalysisPlan(plan, profile.columns);
    assertTrue(validation.isValid === true, 'TEST 2 - Validation is valid');
  }

  // TEST 3
  {
    const question = 'Why is the South region performing poorly?';
    const plan = getPlan(question);

    assertTrue(plan.operation === 'insight_analysis', 'TEST 3 - Operation is insight_analysis');
    assertTrue(plan.target_measure === 'Sales', 'TEST 3 - Target measure is Sales');

    const validation = validateAnalysisPlan(plan, profile.columns);
    assertTrue(validation.isValid === true, 'TEST 3 - Validation is valid');

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    assertTrue(execResult.status === 'success', 'TEST 3 - Execution success');
    assertTrue(execResult.metadata.dimensionBreakdowns !== undefined, 'TEST 3 - Dimension breakdowns defined');
  }

  // TEST 4
  {
    const question = 'Why did Order_ID decrease?';
    const plan = getPlan(question);

    assertTrue(plan.status === 'cannot_answer', 'TEST 4 - Rejected Order_ID insight query');
    assertTrue(plan.reason.includes('identifier'), 'TEST 4 - Stated reason mentions identifier');
  }

  // TEST 5
  {
    const question = 'Explain the unusual drop in sales.';
    const plan = getPlan(question);
    const validation = validateAnalysisPlan(plan, profile.columns);
    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });

    assertTrue(!explanation.includes('caused'), 'TEST 5 - Non-causal rule check for caused');
    assertTrue(!explanation.includes('is the reason for'), 'TEST 5 - Non-causal rule check for is the reason for');
  }

  console.log(`\nPHASE 13 INSIGHTS & ROOT-CAUSE TEST RESULTS: ${passedCount}/${totalCount} tests passed.\n`);
}

if (require.main === module) {
  runInsightsTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runInsightsTests };

