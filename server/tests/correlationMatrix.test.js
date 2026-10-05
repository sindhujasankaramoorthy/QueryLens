const { heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { generateExplanation } = require('../src/services/llmExplainer');
const { profileDataset } = require('../src/services/profiler');

describe('Phase 10 — Correlation & Relationship Analysis Tests', () => {

  // Mock dataset matching prompt specs
  const mockDataset = [
    { Order_ID: 1001, Sales: 100, Quantity: 10, Customer_Rating: 4.5, Region: 'North', Order_Date: '2023-01-01' },
    { Order_ID: 1002, Sales: 200, Quantity: 20, Customer_Rating: 4.0, Region: 'South', Order_Date: '2023-01-02' },
    { Order_ID: 1003, Sales: 300, Quantity: 30, Customer_Rating: 3.5, Region: 'East', Order_Date: '2023-01-03' },
    { Order_ID: 1004, Sales: 400, Quantity: 40, Customer_Rating: 3.0, Region: 'West', Order_Date: '2023-01-04' },
    { Order_ID: 1005, Sales: 500, Quantity: 50, Customer_Rating: 2.5, Region: 'North', Order_Date: '2023-01-05' },
    { Order_ID: 1006, Sales: null, Quantity: 60, Customer_Rating: 2.0, Region: 'South', Order_Date: '2023-01-06' }, // missing sales
    { Order_ID: 1007, Sales: 700, Quantity: null, Customer_Rating: 1.5, Region: 'East', Order_Date: '2023-01-07' }  // missing quantity
  ];

  const profile = profileDataset(mockDataset);

  function getPlan(question) {
    const res = heuristicFallbackPlanner(question, profile.columns);
    return res.plan || res;
  }

  test('TEST 1: Is there a relationship between Sales and Quantity?', async () => {
    const question = 'Is there a relationship between Sales and Quantity?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('correlation');
    expect([plan.column_x, plan.columnX, plan.column]).toContain('Sales');
    expect([plan.column_y, plan.columnY, plan.measure]).toContain('Quantity');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.operation).toBe('correlation');
    expect(execResult.metadata.columnX).toBe('Sales');
    expect(execResult.metadata.columnY).toBe('Quantity');
    expect(execResult.metadata.pearsonR).toBe(1); // Perfect positive correlation in test data
    expect(execResult.metadata.direction).toBe('Positive');
    expect(execResult.metadata.strength).toBe('Very Strong');
    expect(execResult.metadata.scatterPoints.length).toBe(5); // 7 total, 2 excluded due to nulls

    const explanation = await generateExplanation({ ...execResult, question, plan: validation.plan }, { forceFallback: true });
    expect(explanation).toContain('Sales and Quantity show a very strong positive linear relationship');
    expect(explanation).toContain('Correlation does not imply causation');
  });

  test('TEST 2: What is the correlation between Sales and Customer_Rating?', async () => {
    const question = 'What is the correlation between Sales and Customer_Rating?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('correlation');
    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.columnX).toBe('Sales');
    expect(execResult.metadata.columnY).toBe('Customer_Rating');
    expect(execResult.metadata.pearsonR).toBe(-1); // Perfect negative in test data
    expect(execResult.metadata.direction).toBe('Negative');
    expect(execResult.metadata.strength).toBe('Very Strong');
  });

  test('TEST 3: Which variables are correlated with Sales?', async () => {
    const question = 'Which variables are correlated with Sales?';
    const plan = getPlan(question);

    expect(plan.operation).toBe('correlation_matrix');
    expect(plan.target_column).toBe('Sales');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.targetColumn).toBe('Sales');
    expect(execResult.metadata.targetFactors).toBeDefined();
    expect(execResult.metadata.targetFactors.length).toBe(2); // Quantity and Customer_Rating (Order_ID excluded!)

    const variables = execResult.metadata.targetFactors.map(f => f.variable);
    expect(variables).not.toContain('Order_ID');
    expect(variables).not.toContain('Region');
  });

  test('TEST 4: Show the correlation matrix.', async () => {
    const question = 'Show the correlation matrix.';
    const plan = getPlan(question);

    expect(plan.operation).toBe('correlation_matrix');

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);
    expect(validation.plan.columns).not.toContain('Order_ID');

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.matrixMap).toBeDefined();

    // Check diagonal = 1.00
    expect(execResult.metadata.matrixMap['Sales']['Sales']).toBe(1);
    expect(execResult.metadata.matrixMap['Quantity']['Quantity']).toBe(1);
    expect(execResult.metadata.matrixMap['Customer_Rating']['Customer_Rating']).toBe(1);

    // Check symmetry
    const r1 = execResult.metadata.matrixMap['Sales']['Quantity'];
    const r2 = execResult.metadata.matrixMap['Quantity']['Sales'];
    expect(r1).toBe(r2);
  });

  test('TEST 5: What is the correlation between Order_ID and Sales? (REJECT)', async () => {
    // Direct plan validation rejection check
    const rawPlan = {
      operation: 'correlation',
      column_x: 'Order_ID',
      column_y: 'Sales',
      method: 'pearson'
    };

    const directValidation = validateAnalysisPlan(rawPlan, profile.columns);
    expect(directValidation.status).toBe('cannot_answer');
    expect(directValidation.reason).toContain('Cannot calculate correlation.');
    expect(directValidation.reason).toContain('Order_ID is classified as an identifier, not an analytical measure.');
    expect(directValidation.reason).toContain('Identifier columns are excluded from correlation analysis');

    // Planner query rejection check
    const question = 'What is the correlation between Order_ID and Sales?';
    const plan = getPlan(question);
    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.status).toBe('cannot_answer');
    expect(validation.reason).toContain('Order_ID');
  });

  test('TEST 6: Are Sales and Quantity strongly correlated?', async () => {
    const question = 'Are Sales and Quantity strongly correlated?';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const execResult = executeAnalysisPlan(validation.plan, mockDataset);
    expect(execResult.status).toBe('success');
    expect(execResult.metadata.strength).toBe('Very Strong');
  });

  test('TEST 7: Show correlation between all numerical variables.', async () => {
    const question = 'Show correlation between all numerical variables.';
    const plan = getPlan(question);

    const validation = validateAnalysisPlan(plan, profile.columns);
    expect(validation.isValid).toBe(true);

    const cols = validation.plan.columns;
    expect(cols).toContain('Sales');
    expect(cols).toContain('Quantity');
    expect(cols).toContain('Customer_Rating');
    expect(cols).not.toContain('Order_ID');
  });

  test('EDGE CASE: Constant-column zero variance correlation', async () => {
    const constantDataset = [
      { Sales: 10, Quantity: 100 },
      { Sales: 10, Quantity: 200 },
      { Sales: 10, Quantity: 300 }
    ];

    const plan = {
      operation: 'correlation',
      column_x: 'Sales',
      column_y: 'Quantity',
      method: 'pearson'
    };

    const execResult = executeAnalysisPlan(plan, constantDataset);
    expect(execResult.status).toBe('cannot_answer');
    expect(execResult.reason).toContain('Correlation undefined because one variable has zero variance.');
  });

});
