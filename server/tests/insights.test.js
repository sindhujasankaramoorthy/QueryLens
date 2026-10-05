const { heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');
const { profileDataset } = require('../src/services/profiler');

describe('Phase 13 — Automated Insight & Evidence-Based Root-Cause Analysis Tests', () => {

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

  test('TEST 1: Why did sales decrease in October 2026?', async () => {
    const question = 'Why did sales decrease in October 2026?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('insight_analysis');
    expect(plan.target_measure).toBe('Sales');
    expect(plan.target_period).toBe('2026-10');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.operation).toBe('insight_analysis');
    expect(execResult.metadata.targetMeasure).toBe('Sales');
    expect(execResult.metadata.targetPeriod).toBe('2026-10');
    expect(execResult.metadata.comparisonPeriod).toBe('2026-09');
    expect(execResult.metadata.absoluteChange).toBe(-310000); // 890,000 - 1,200,000 = -310,000
    expect(execResult.metadata.direction).toBe('decrease');
    expect(execResult.metadata.topContributors.length).toBeGreaterThan(0);

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    expect(explanation).toContain('Sales');
    expect(explanation).not.toContain('caused');
  });

  test('TEST 2: What factors contributed to the increase in sales?', async () => {
    const question = 'What factors contributed to the increase in sales?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('insight_analysis');
    expect(plan.target_measure).toBe('Sales');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);
  });

  test('TEST 3: Why is the South region performing poorly?', async () => {
    const question = 'Why is the South region performing poorly?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('insight_analysis');
    expect(plan.target_measure).toBe('Sales');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.dimensionBreakdowns).toBeDefined();
  });

  test('TEST 4: Why did Order_ID decrease? (Identifier protection)', async () => {
    const question = 'Why did Order_ID decrease?';
    const plan = getPlan(question);

    expect(plan.status).toBe('cannot_answer');
    expect(plan.reason).toContain('identifier');
  });

  test('TEST 5: Non-causal explanation check', async () => {
    const question = 'Explain the unusual drop in sales.';
    const plan = getPlan(question);
    const validation = validateAnalysisPlan(plan, profile.columns);
    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });

    expect(explanation).not.toContain('caused');
    expect(explanation).not.toContain('is the reason for');
  });
});
