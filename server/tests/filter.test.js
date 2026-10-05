const assert = require('assert');
const { generateAnalysisPlan } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');

async function runFilterRegressionTests() {
  console.log('--- RUNNING PSA01 FILTER & NUMERIC/CATEGORICAL COMPARISON REGRESSION SUITE ---');

  const patientSchema = [
    { name: 'Patient_ID', type: 'string', semanticType: 'identifier' },
    { name: 'Age', type: 'integer', semanticType: 'measure' },
    { name: 'Gender', type: 'categorical', semanticType: 'categorical' },
    { name: 'Temperature_F', type: 'float', semanticType: 'measure' },
    { name: 'SpO2_Percent', type: 'integer', semanticType: 'measure' },
    { name: 'Heart_Rate_BPM', type: 'integer', semanticType: 'measure' },
    { name: 'Blood_Pressure', type: 'string', semanticType: 'categorical' },
    { name: 'Symptoms', type: 'text', semanticType: 'categorical' }
  ];

  const patientRows = [
    { Patient_ID: 'P001', Age: 45, Gender: 'Male', Temperature_F: 98.6, SpO2_Percent: 98, Heart_Rate_BPM: 72, Blood_Pressure: '120/80', Symptoms: 'Normal' },
    { Patient_ID: 'P002', Age: 62, Gender: 'Female', Temperature_F: 99.1, SpO2_Percent: 96, Heart_Rate_BPM: 80, Blood_Pressure: '130/85', Symptoms: 'Mild Cough' },
    { Patient_ID: 'P003', Age: 58, Gender: 'Male', Temperature_F: 100.1, SpO2_Percent: 94, Heart_Rate_BPM: 92, Blood_Pressure: '140/90', Symptoms: 'Fever' },
    { Patient_ID: 'P004', Age: 71, Gender: 'Female', Temperature_F: 102.4, SpO2_Percent: 91, Heart_Rate_BPM: 105, Blood_Pressure: '150/95', Symptoms: 'High Fever' },
    { Patient_ID: 'P005', Age: 29, Gender: 'Male', Temperature_F: 98.4, SpO2_Percent: 99, Heart_Rate_BPM: 68, Blood_Pressure: '118/75', Symptoms: 'None' },
    { Patient_ID: 'P006', Age: 65, Gender: 'Female', Temperature_F: 103.1, SpO2_Percent: 89, Heart_Rate_BPM: 110, Blood_Pressure: '160/100', Symptoms: 'Severe Fever' },
    { Patient_ID: 'P007', Age: 40, Gender: 'Male', Temperature_F: 98.8, SpO2_Percent: 97, Heart_Rate_BPM: 75, Blood_Pressure: '122/80', Symptoms: 'Fatigue' },
    { Patient_ID: 'P008', Age: 78, Gender: 'Female', Temperature_F: 101.5, SpO2_Percent: 93, Heart_Rate_BPM: 88, Blood_Pressure: '145/92', Symptoms: 'Fever' },
    { Patient_ID: 'P009', Age: 34, Gender: 'Male', Temperature_F: 97.9, SpO2_Percent: 98, Heart_Rate_BPM: 70, Blood_Pressure: '115/72', Symptoms: 'None' },
    { Patient_ID: 'P010', Age: 82, Gender: 'Female', Temperature_F: 102.8, SpO2_Percent: 90, Heart_Rate_BPM: 102, Blood_Pressure: '155/96', Symptoms: 'High Fever' },
    { Patient_ID: 'P011', Age: 50, Gender: 'Male', Temperature_F: 99.5, SpO2_Percent: 95, Heart_Rate_BPM: 78, Blood_Pressure: '128/82', Symptoms: 'Headache' },
    { Patient_ID: 'P012', Age: 22, Gender: 'Female', Temperature_F: 98.2, SpO2_Percent: 99, Heart_Rate_BPM: 65, Blood_Pressure: '110/70', Symptoms: 'None' }
  ];

  // Test 1: Temperature > 100°F (Exact Phase 16 User Query)
  {
    const q = 'Show all patients with temperature above 100°F.';
    const planRes = await generateAnalysisPlan(q, patientSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.ok(planRes.plan.filters && planRes.plan.filters.length === 1);
    assert.strictEqual(planRes.plan.filters[0].column, 'Temperature_F');
    assert.strictEqual(planRes.plan.filters[0].operator, '>');
    assert.strictEqual(planRes.plan.filters[0].value, 100);

    const execRes = executeAnalysisPlan(planRes.plan, patientRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 5, 'Must return exactly 5 matching patients');

    const returnedIds = execRes.result.map(r => r.Patient_ID);
    assert.deepStrictEqual(returnedIds, ['P003', 'P004', 'P006', 'P008', 'P010']);
    assert.strictEqual(execRes.metadata.rowsAnalyzed, 5);
    console.log('✓ PASS: Test 1 - "Show all patients with temperature above 100°F." -> Exact 5 patients (P003, P004, P006, P008, P010)');
  }

  // Test 2: Numeric filter Age >= 60
  {
    const q = 'Show patients with Age >= 60';
    const planRes = await generateAnalysisPlan(q, patientSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.ok(planRes.plan.filters && planRes.plan.filters.length === 1);
    assert.strictEqual(planRes.plan.filters[0].column, 'Age');
    assert.strictEqual(planRes.plan.filters[0].operator, '>=');
    assert.strictEqual(planRes.plan.filters[0].value, 60);

    const execRes = executeAnalysisPlan(planRes.plan, patientRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 5);
    const returnedIds = execRes.result.map(r => r.Patient_ID);
    assert.deepStrictEqual(returnedIds, ['P002', 'P004', 'P006', 'P008', 'P010']);
    console.log('✓ PASS: Test 2 - Numeric filter "Age >= 60" -> Exact 5 patients');
  }

  // Test 3: Numeric filter SpO2_Percent < 95
  {
    const q = 'Show patients with SpO2 below 95';
    const planRes = await generateAnalysisPlan(q, patientSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.ok(planRes.plan.filters && planRes.plan.filters.length === 1);
    assert.strictEqual(planRes.plan.filters[0].column, 'SpO2_Percent');
    assert.strictEqual(planRes.plan.filters[0].operator, '<');
    assert.strictEqual(planRes.plan.filters[0].value, 95);

    const execRes = executeAnalysisPlan(planRes.plan, patientRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 5);
    const returnedIds = execRes.result.map(r => r.Patient_ID);
    assert.deepStrictEqual(returnedIds, ['P003', 'P004', 'P006', 'P008', 'P010']);
    console.log('✓ PASS: Test 3 - Numeric filter "SpO2 below 95" -> Exact 5 patients');
  }

  // Test 4: Numeric filter Heart_Rate_BPM <= 70
  {
    const q = 'Show patients with Heart_Rate_BPM at most 70';
    const planRes = await generateAnalysisPlan(q, patientSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.ok(planRes.plan.filters && planRes.plan.filters.length === 1);
    assert.strictEqual(planRes.plan.filters[0].column, 'Heart_Rate_BPM');
    assert.strictEqual(planRes.plan.filters[0].operator, '<=');
    assert.strictEqual(planRes.plan.filters[0].value, 70);

    const execRes = executeAnalysisPlan(planRes.plan, patientRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 3);
    console.log('✓ PASS: Test 4 - Numeric filter "Heart_Rate_BPM at most 70" -> Exact 3 patients');
  }

  // Test 5: Equality filter Age = 50
  {
    const q = 'Show patients with Age = 50';
    const planRes = await generateAnalysisPlan(q, patientSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.ok(planRes.plan.filters && planRes.plan.filters.length === 1);
    assert.strictEqual(planRes.plan.filters[0].column, 'Age');
    assert.strictEqual(planRes.plan.filters[0].operator, '=');
    assert.strictEqual(planRes.plan.filters[0].value, 50);

    const execRes = executeAnalysisPlan(planRes.plan, patientRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 1);
    assert.strictEqual(execRes.result[0].Patient_ID, 'P011');
    console.log('✓ PASS: Test 5 - Numeric filter "Age = 50" -> Exact 1 patient (P011)');
  }

  // Test 6: Generic Sales filter > 100000
  {
    const salesSchema = [
      { name: 'Order_ID', type: 'integer', semanticType: 'identifier' },
      { name: 'Sales', type: 'float', semanticType: 'measure' },
      { name: 'Region', type: 'categorical', semanticType: 'categorical' }
    ];
    const salesRows = [
      { Order_ID: 1, Sales: 150000, Region: 'South' },
      { Order_ID: 2, Sales: 80000, Region: 'North' },
      { Order_ID: 3, Sales: 200000, Region: 'South' },
      { Order_ID: 4, Sales: 50000, Region: 'East' }
    ];
    const q = 'Show sales > 100000';
    const planRes = await generateAnalysisPlan(q, salesSchema, { forceFallback: true });
    assert.strictEqual(planRes.status, 'validated');
    assert.strictEqual(planRes.plan.filters[0].column, 'Sales');
    assert.strictEqual(planRes.plan.filters[0].operator, '>');
    assert.strictEqual(planRes.plan.filters[0].value, 100000);

    const execRes = executeAnalysisPlan(planRes.plan, salesRows);
    assert.strictEqual(execRes.status, 'success');
    assert.strictEqual(execRes.result.length, 2);
    console.log('✓ PASS: Test 6 - Generic "Sales > 100000" -> Exact 2 rows');
  }

  console.log('\nFILTER REGRESSION TEST RESULTS: 6/6 tests passed.\n');
}

if (require.main === module) {
  runFilterRegressionTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runFilterRegressionTests };
