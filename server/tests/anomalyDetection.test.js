const { heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');
const { profileDataset } = require('../src/services/profiler');

describe('Phase 11 — Advanced Anomaly Detection Tests', () => {

  // Mock dataset with a clear multivariate anomaly
  const mockDataset = [
    { Order_ID: 1001, Sales: 100, Quantity: 10, Customer_Rating: 4.5, Region: 'North' },
    { Order_ID: 1002, Sales: 120, Quantity: 12, Customer_Rating: 4.6, Region: 'South' },
    { Order_ID: 1003, Sales: 110, Quantity: 11, Customer_Rating: 4.4, Region: 'East' },
    { Order_ID: 1004, Sales: 130, Quantity: 13, Customer_Rating: 4.7, Region: 'West' },
    { Order_ID: 1005, Sales: 105, Quantity: 10, Customer_Rating: 4.5, Region: 'North' },
    { Order_ID: 1006, Sales: 115, Quantity: 11, Customer_Rating: 4.3, Region: 'South' },
    { Order_ID: 1007, Sales: 125, Quantity: 12, Customer_Rating: 4.6, Region: 'East' },
    // Multivariate anomaly: Unusually high Sales with low Quantity and low Rating
    { Order_ID: 1008, Sales: 950, Quantity: 2, Customer_Rating: 1.0, Region: 'West' }
  ];

  const profile = profileDataset(mockDataset);

  function getPlan(question) {
    const res = heuristicFallbackPlanner(question, profile.columns);
    return res.plan || res;
  }

  test('TEST 1: Find anomalies in the dataset.', async () => {
    const question = 'Find anomalies in the dataset.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('anomaly_detection');
    expect(plan.method).toBe('isolation_forest');
    expect(plan.random_state).toBe(42);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);
    expect(validation.plan.features).not.toContain('Order_ID');
    expect(validation.plan.features).toContain('Sales');
    expect(validation.plan.features).toContain('Quantity');
    expect(validation.plan.features).toContain('Customer_Rating');

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.operation).toBe('anomaly_detection');
    expect(execResult.metadata.method).toBe('Isolation Forest');
    expect(execResult.metadata.randomState).toBe(42);
    expect(execResult.metadata.anomaliesDetected).toBeGreaterThanOrEqual(1);
    expect(execResult.metadata.scatterPoints).toBeDefined();

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    expect(explanation).toContain('Isolation Forest model');
    expect(explanation).toContain('42');
    expect(explanation).toContain('does not establish causation');
  });

  test('TEST 2: Which records are anomalous?', async () => {
    const question = 'Which records are anomalous?';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');

    const anomalies = execResult.result.filter(r => r['Anomaly Status'] === 'Anomaly');
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].Order_ID).toBe(1008);
  });

  test('TEST 3: Find anomalies using Sales, Quantity and Customer_Rating.', async () => {
    const question = 'Find anomalies using Sales, Quantity and Customer_Rating.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('anomaly_detection');
    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    expect(validation.plan.features).toEqual(expect.arrayContaining(['Sales', 'Quantity', 'Customer_Rating']));

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.features).toEqual(expect.arrayContaining(['Sales', 'Quantity', 'Customer_Rating']));
  });

  test('TEST 4: Show the most unusual records and explain why.', async () => {
    const question = 'Show the most unusual records and explain why.';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    expect(explanation).toContain('1008');
    expect(explanation).toContain('does not establish causation');
  });

  test('TEST 5: Find anomalies using Order_ID and Sales. (REJECT Order_ID as feature)', async () => {
    const question = 'Find anomalies using Order_ID and Sales.';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.status).toBe('cannot_answer');
    expect(validation.reason).toContain('Order_ID is an identifier and cannot be used as an anomaly-detection feature.');
  });

  test('TEST 6: Distinguish Phase 7 IQR outliers and Phase 11 multivariate anomalies', async () => {
    const execResult = executeAnalysisPlan({ operation: 'anomaly_detection', features: ['Sales', 'Quantity'], random_state: 42 }, mockDataset);
    expect(execResult.metadata.operation).toBe('anomaly_detection');
    expect(execResult.metadata.method).toBe('Isolation Forest');

    // Result should explicitly expose Anomaly Status and Anomaly Score, NOT IQR Outlier
    expect(execResult.result[0]['Anomaly Status']).toBeDefined();
    expect(execResult.result[0]['Anomaly Score']).toBeDefined();
    expect(execResult.result[0]['IQR Outlier']).toBeUndefined();
  });

});
