const { heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');
const { profileDataset } = require('../src/services/profiler');

describe('Phase 12 — Forecasting & Prediction Tests', () => {

  // Mock multi-month dataset for forecasting tests
  const mockDataset = [
    { Order_ID: 1001, Order_Date: '2025-05-15', Sales: 100000, Quantity: 100, Customer_Rating: 4.5 },
    { Order_ID: 1002, Order_Date: '2025-06-15', Sales: 120000, Quantity: 110, Customer_Rating: 4.6 },
    { Order_ID: 1003, Order_Date: '2025-07-15', Sales: 110000, Quantity: 105, Customer_Rating: 4.4 },
    { Order_ID: 1004, Order_Date: '2025-08-15', Sales: 130000, Quantity: 120, Customer_Rating: 4.7 },
    { Order_ID: 1005, Order_Date: '2025-09-15', Sales: 140000, Quantity: 125, Customer_Rating: 4.5 },
    { Order_ID: 1006, Order_Date: '2025-10-15', Sales: 150000, Quantity: 130, Customer_Rating: 4.8 }
  ];

  const profile = profileDataset(mockDataset);

  function getPlan(question) {
    const res = heuristicFallbackPlanner(question, profile.columns);
    return res.plan || res;
  }

  test('TEST 1: Forecast monthly sales for the next 3 months.', async () => {
    const question = 'Forecast monthly sales for the next 3 months.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('forecast');
    expect(plan.target).toBe('Sales');
    expect(plan.granularity).toBe('MONTH');
    expect(plan.horizon).toBe(3);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);
    expect(validation.plan.target).toBe('Sales');
    expect(validation.plan.date_column).toBe('Order_Date');
    expect(validation.plan.horizon).toBe(3);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.operation).toBe('forecast');
    expect(execResult.metadata.target).toBe('Sales');
    expect(execResult.metadata.horizon).toBe(3);
    expect(execResult.metadata.method).toBe('Linear Regression');
    expect(execResult.metadata.backtestMetrics).toBeDefined();
    expect(execResult.metadata.backtestMetrics.mae).toBeGreaterThanOrEqual(0);

    const historicalRows = execResult.result.filter(r => r.Type === 'Historical');
    const forecastRows = execResult.result.filter(r => r.Type === 'Forecast');

    expect(historicalRows.length).toBe(6);
    expect(forecastRows.length).toBe(3);
    expect(forecastRows[0].Period).toBe('2025-11');
    expect(forecastRows[0]['Lower Bound (95%)']).toBeDefined();
    expect(forecastRows[0]['Upper Bound (95%)']).toBeDefined();

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    expect(explanation).toContain('Linear Regression');
    expect(explanation).toContain('3 months');
  });

  test('TEST 2: Predict the next 6 months of sales.', async () => {
    const question = 'Predict the next 6 months of sales.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('forecast');
    expect(plan.target).toBe('Sales');
    expect(plan.horizon).toBe(6);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    const forecastRows = execResult.result.filter(r => r.Type === 'Forecast');
    expect(forecastRows.length).toBe(6);
  });

  test('TEST 3: Forecast weekly quantity for the next 4 weeks.', async () => {
    const question = 'Forecast weekly quantity for the next 4 weeks.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('forecast');
    expect(plan.target).toBe('Quantity');
    expect(plan.granularity).toBe('WEEK');
    expect(plan.horizon).toBe(4);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);
    expect(validation.plan.target).toBe('Quantity');

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.target).toBe('Quantity');
  });

  test('TEST 4: Show monthly sales over time. (MUST be Phase 9 Trend Analysis, NOT Forecast)', async () => {
    const question = 'Show monthly sales over time.';
    const plan = getPlan(question);

    expect(plan.operation).not.toBe('forecast');
    expect(['time_series', 'time_group']).toContain(plan.operation);
  });

  test('TEST 5: Forecast Order_ID for the next 3 months. (REJECT identifier target)', async () => {
    const question = 'Forecast Order_ID for the next 3 months.';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.status).toBe('cannot_answer');
    expect(validation.reason).toContain('Order_ID is an identifier column and cannot be used as a forecasting target.');
  });

});
