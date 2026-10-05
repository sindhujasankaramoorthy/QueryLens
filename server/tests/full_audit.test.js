const assert = require('assert');
const { profileDataset } = require('../src/services/profiler');
const { parseFileBuffer } = require('../src/services/parser');
const { generateAnalysisPlan, heuristicFallbackPlanner } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan, filterRows } = require('../src/services/analysisEngine');
const { determineVisualization } = require('../src/services/chartSelector');
const { generateExplanation, verifyAndSanitizeExplanation } = require('../src/services/llmExplainer');

console.log("==================================================");
console.log("     PSA01 FULL TECHNICAL AUDIT & HARDENING     ");
console.log("==================================================");

let totalAuditTests = 0;
let passedAuditTests = 0;
let failedAuditTests = 0;
const auditFailures = [];

async function auditTest(phaseName, testName, fn) {
  totalAuditTests++;
  try {
    await fn();
    console.log(`[${phaseName}] ✓ PASS: ${testName}`);
    passedAuditTests++;
  } catch (err) {
    console.error(`[${phaseName}] ✗ FAIL: ${testName}`);
    console.error(err);
    failedAuditTests++;
    auditFailures.push({ phase: phaseName, name: testName, error: err.message });
  }
}

// 20-row Master Audit Dataset matching exact requirements
const masterAuditSchema = [
  { name: 'Order_ID', type: 'integer' },
  { name: 'Order_Date', type: 'date' },
  { name: 'Product', type: 'categorical' },
  { name: 'Region', type: 'categorical' },
  { name: 'Sales', type: 'float' },
  { name: 'Quantity', type: 'integer' },
  { name: 'Customer_Rating', type: 'float' }
];

const masterAuditDataset = [
  // North (Sales: 218,000, Quantity: 85)
  { Order_ID: 1001, Order_Date: '2025-01-15', Product: 'Laptop', Region: 'North', Sales: 120000, Quantity: 40, Customer_Rating: 4.5 },
  { Order_ID: 1002, Order_Date: '2025-01-20', Product: 'Phone', Region: 'North', Sales: 47000, Quantity: 20, Customer_Rating: 4.0 },
  { Order_ID: 1003, Order_Date: '2025-02-05', Product: 'Headphones', Region: 'North', Sales: 18000, Quantity: 15, Customer_Rating: 4.2 },
  { Order_ID: 1004, Order_Date: '2025-02-12', Product: 'Keyboard', Region: 'North', Sales: 15000, Quantity: 5, Customer_Rating: 4.8 },
  { Order_ID: 1005, Order_Date: '2025-03-01', Product: 'Mouse', Region: 'North', Sales: 18000, Quantity: 5, Customer_Rating: 4.1 },

  // South (Sales: 183,500, Quantity: 61)
  { Order_ID: 1006, Order_Date: '2025-03-10', Product: 'Laptop', Region: 'South', Sales: 110000, Quantity: 25, Customer_Rating: 4.6 },
  { Order_ID: 1007, Order_Date: '2025-03-25', Product: 'Phone', Region: 'South', Sales: 50000, Quantity: 20, Customer_Rating: 4.3 },
  { Order_ID: 1008, Order_Date: '2025-04-02', Product: 'Headphones', Region: 'South', Sales: 12000, Quantity: 10, Customer_Rating: 3.9 },
  { Order_ID: 1009, Order_Date: '2025-04-15', Product: 'Keyboard', Region: 'South', Sales: 10500, Quantity: 5, Customer_Rating: 4.0 },
  { Order_ID: 1010, Order_Date: '2025-04-20', Product: 'Mouse', Region: 'South', Sales: 1000, Quantity: 1, Customer_Rating: 4.5 },

  // East (Sales: 162,500, Quantity: 81)
  { Order_ID: 1011, Order_Date: '2025-05-01', Product: 'Laptop', Region: 'East', Sales: 80000, Quantity: 20, Customer_Rating: 4.7 },
  { Order_ID: 1012, Order_Date: '2025-05-18', Product: 'Phone', Region: 'East', Sales: 50000, Quantity: 25, Customer_Rating: 4.2 },
  { Order_ID: 1013, Order_Date: '2025-06-05', Product: 'Headphones', Region: 'East', Sales: 14000, Quantity: 15, Customer_Rating: 4.4 },
  { Order_ID: 1014, Order_Date: '2025-06-15', Product: 'Mouse', Region: 'East', Sales: 12500, Quantity: 15, Customer_Rating: 3.8 },
  { Order_ID: 1015, Order_Date: '2025-06-25', Product: 'Laptop', Region: 'East', Sales: 6000, Quantity: 6, Customer_Rating: 4.0 },

  // West (Sales: 159,500, Quantity: 56)
  { Order_ID: 1016, Order_Date: '2025-06-28', Product: 'Laptop', Region: 'West', Sales: 64000, Quantity: 15, Customer_Rating: 4.1 },
  { Order_ID: 1017, Order_Date: '2025-06-29', Product: 'Phone', Region: 'West', Sales: 100000, Quantity: 30, Customer_Rating: 4.6 },
  { Order_ID: 1018, Order_Date: '2025-06-30', Product: 'Headphones', Region: 'West', Sales: 10000, Quantity: 5, Customer_Rating: 4.3 },
  { Order_ID: 1019, Order_Date: '2025-06-30', Product: 'Mouse', Region: 'West', Sales: -7000, Quantity: 1, Customer_Rating: 3.5 }, // Adjust for totals
  { Order_ID: 1020, Order_Date: '2025-06-30', Product: 'Laptop', Region: 'West', Sales: -8000, Quantity: 5, Customer_Rating: null } // 1 missing rating
];

(async () => {
  console.log("\n--- AUDITING PHASE 1 ---");

  await auditTest('PHASE 1', 'CSV & Array Dataset Profiling & Basic Quality', () => {
    const profile = profileDataset(masterAuditDataset);
    assert.strictEqual(profile.rowCount, 20);
    assert.strictEqual(profile.columnCount, 7);
    const ratingCol = profile.columns.find(c => c.name === 'Customer_Rating');
    assert.strictEqual(ratingCol.missingCount, 1);
    assert.strictEqual(profile.duplicates.count, 0);
  });

  await auditTest('PHASE 1', 'Column Name Variations & Mixed Types', () => {
    const dirtyRows = [
      { "Customer Rating": "4.5", " ORDER DATE ": "2025-01-01", "TOTAL_SALES": 100 },
      { "Customer Rating": null, " ORDER DATE ": "2025-01-02", "TOTAL_SALES": "200" }
    ];
    const profile = profileDataset(dirtyRows);
    assert.strictEqual(profile.rowCount, 2);
    assert.strictEqual(profile.columnCount, 3);
  });

  console.log("\n--- AUDITING PHASE 2 ---");

  await auditTest('PHASE 2', 'Question Plan Generation & Column Normalization', async () => {
    const questions = [
      { q: 'What is the total sales?', op: 'sum', measure: 'Sales' },
      { q: 'What is the average quantity?', op: 'average', measure: 'Quantity' },
      { q: 'Which region has the highest total sales?', op: 'group_aggregate', groupBy: 'Region', limit: 1 },
      { q: 'Show total sales by region.', op: 'group_aggregate', groupBy: 'Region', limit: null },
      { q: 'Show total sales by month.', op: 'time_group', column: 'Order_Date', timeUnit: 'month' },
      { q: 'Show total sales by product.', op: 'group_aggregate', groupBy: 'Product' },
      { q: 'What is the average customer rating?', op: 'average', measure: 'Customer_Rating' },
      { q: 'What is the maximum sales?', op: 'max', measure: 'Sales' },
      { q: 'Show the bottom 3 products.', op: 'bottom_n', limit: 3 }
    ];

    for (const item of questions) {
      const res = await generateAnalysisPlan(item.q, masterAuditSchema, { forceFallback: true });
      assert.strictEqual(res.isValid, true, `Failed on query: "${item.q}"`);
      assert.strictEqual(res.plan.operation, item.op, `Op mismatch on "${item.q}"`);
      if (item.measure) assert.strictEqual(res.plan.measure, item.measure);
      if (item.groupBy) assert.strictEqual(res.plan.groupBy, item.groupBy);
      if (item.limit !== undefined) assert.strictEqual(res.plan.limit, item.limit);
    }
  });

  await auditTest('PHASE 2', 'Column Name Spelling Variations (customer rating)', async () => {
    const variations = [
      'What is the average Customer_Rating?',
      'What is the average Customer Rating?',
      'What is the average customer_rating?',
      'What is the average CUSTOMER_RATING?',
      'What is the average customer rating?'
    ];
    for (const q of variations) {
      const res = await generateAnalysisPlan(q, masterAuditSchema, { forceFallback: true });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.plan.measure, 'Customer_Rating');
    }
  });

  await auditTest('PHASE 2', 'Rejections & Safety Checks (cannot_answer, clarification_required, injection)', async () => {
    const invalidCol = await generateAnalysisPlan('What is the total profit?', masterAuditSchema, { forceFallback: true });
    assert.strictEqual(invalidCol.status, 'cannot_answer');

    const ambiguous = await generateAnalysisPlan('What is the best product?', masterAuditSchema, { forceFallback: true });
    assert.strictEqual(ambiguous.status, 'clarification_required');

    const codeInjection = validateAnalysisPlan({ operation: 'sum', measure: 'Sales; eval("process.exit()")' }, masterAuditSchema);
    assert.strictEqual(codeInjection.isValid, false);
    assert.strictEqual(codeInjection.status, 'rejected');
  });

  console.log("\n--- AUDITING PHASE 3 ---");

  await auditTest('PHASE 3', 'Show total sales by region (Exact 4 Groups)', () => {
    const plan = { operation: 'group_aggregate', groupBy: 'Region', measure: 'Sales', aggregation: 'sum', sort: 'descending' };
    const res = executeAnalysisPlan(plan, masterAuditDataset);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result.length, 4);

    const resultMap = Object.fromEntries(res.result.map(r => [r.Region, r.Sales_sum]));
    assert.strictEqual(resultMap.North, 218000);
    assert.strictEqual(resultMap.South, 183500);
    assert.strictEqual(resultMap.East, 162500);
    assert.strictEqual(resultMap.West, 159000);
  });

  await auditTest('PHASE 3', 'Show total quantity by region (Exact 4 Groups)', () => {
    const plan = { operation: 'group_aggregate', groupBy: 'Region', measure: 'Quantity', aggregation: 'sum', sort: 'descending' };
    const res = executeAnalysisPlan(plan, masterAuditDataset);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.result.length, 4);

    const resultMap = Object.fromEntries(res.result.map(r => [r.Region, r.Quantity_sum]));
    assert.strictEqual(resultMap.North, 85);
    assert.strictEqual(resultMap.South, 61);
    assert.strictEqual(resultMap.East, 81);
    assert.strictEqual(resultMap.West, 56);
  });

  console.log("\n--- AUDITING STALE STATE & QUERY ISOLATION ---");

  await auditTest('ISOLATION', 'Sequential Query State Isolation (7 Queries)', async () => {
    let currentContext = null;

    const sequence = [
      { q: "Which region has the highest total sales?", expectedOp: "group_aggregate", expectedLimit: 1 },
      { q: "Show total sales by region.", expectedOp: "group_aggregate", expectedLimit: null },
      { q: "Show total quantity by region.", expectedOp: "group_aggregate", expectedMeasure: "Quantity", expectedLimit: null },
      { q: "Show total sales by product.", expectedOp: "group_aggregate", expectedGroupBy: "Product", expectedLimit: null },
      { q: "Show total sales by month.", expectedOp: "time_group", expectedTimeUnit: "month" },
      { q: "What is the total sales?", expectedOp: "sum", expectedMeasure: "Sales" },
      { q: "Show total sales by region again.", expectedOp: "group_aggregate", expectedGroupBy: "Region", expectedLimit: null }
    ];

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const planRes = await generateAnalysisPlan(step.q, masterAuditSchema, { forceFallback: true, context: currentContext });
      assert.strictEqual(planRes.isValid, true, `Step ${i + 1} failed plan generation: "${step.q}"`);

      if (step.expectedOp) assert.strictEqual(planRes.plan.operation, step.expectedOp, `Step ${i + 1} op mismatch`);
      if (step.expectedLimit !== undefined) assert.strictEqual(planRes.plan.limit, step.expectedLimit, `Step ${i + 1} limit mismatch`);
      if (step.expectedMeasure) assert.strictEqual(planRes.plan.measure, step.expectedMeasure, `Step ${i + 1} measure mismatch`);
      if (step.expectedGroupBy) assert.strictEqual(planRes.plan.groupBy, step.expectedGroupBy, `Step ${i + 1} groupBy mismatch`);

      const execRes = executeAnalysisPlan(planRes.plan, masterAuditDataset);
      assert.strictEqual(execRes.status, 'success', `Step ${i + 1} failed execution`);

      // Update context for next turn
      currentContext = {
        previousQuestion: step.q,
        previousPlan: planRes.plan,
        previousResult: execRes.result
      };
    }
  });

  console.log("\n--- AUDITING TIME_GROUP & TOP_N/BOTTOM_N ---");

  await auditTest('TIME_GROUP', 'Monthly Time Grouping (Jan - Jun = 723,000 Total)', () => {
    const plan = { operation: 'time_group', column: 'Order_Date', measure: 'Sales', aggregation: 'sum', timeUnit: 'month' };
    const res = executeAnalysisPlan(plan, masterAuditDataset);
    assert.strictEqual(res.result.length, 6);
    const sumAllMonths = res.result.reduce((acc, curr) => acc + curr.Sales_sum, 0);
    assert.strictEqual(sumAllMonths, 723000);
  });

  await auditTest('TOP_N/BOTTOM_N', 'Top 3 & Bottom 3 Products by Sales', () => {
    const top3Plan = { operation: 'top_n', groupBy: 'Product', measure: 'Sales', aggregation: 'sum', limit: 3 };
    const top3Res = executeAnalysisPlan(top3Plan, masterAuditDataset);
    assert.strictEqual(top3Res.result.length, 3);
    assert.strictEqual(top3Res.result[0].Product, 'Laptop');

    const bot3Plan = { operation: 'bottom_n', groupBy: 'Product', measure: 'Sales', aggregation: 'sum', limit: 3 };
    const bot3Res = executeAnalysisPlan(bot3Plan, masterAuditDataset);
    assert.strictEqual(bot3Res.result.length, 3);
    assert.strictEqual(bot3Res.result[0].Product, 'Mouse');
  });

  console.log("\n--- AUDITING NUMERICAL CORRECTNESS & MISSING VALUES ---");

  await auditTest('NUMERICAL', 'Total Sales, Avg Quantity, Rating with missing value', () => {
    const sumRes = executeAnalysisPlan({ operation: 'sum', measure: 'Sales' }, masterAuditDataset);
    assert.strictEqual(sumRes.result[0].Sales, 723000);

    const avgQtyRes = executeAnalysisPlan({ operation: 'average', measure: 'Quantity' }, masterAuditDataset);
    assert.strictEqual(avgQtyRes.result[0].Quantity, 14.15); // 283 / 20 = 14.15

    const avgRatingRes = executeAnalysisPlan({ operation: 'average', measure: 'Customer_Rating' }, masterAuditDataset);
    assert.strictEqual(avgRatingRes.result[0].Customer_Rating, 4.2368); // 80.5 / 19 = 4.2368
    assert.strictEqual(avgRatingRes.metadata.missingValuesIgnored, 1);
  });

  console.log("\n--- AUDITING VISUALIZATION & AI EXPLANATIONS ---");

  await auditTest('VISUALIZATION', 'Automatic Visualization Type Selection', () => {
    const scalarRes = executeAnalysisPlan({ operation: 'sum', measure: 'Sales' }, masterAuditDataset);
    const scalarVis = determineVisualization(scalarRes, { operation: 'sum' });
    assert.strictEqual(scalarVis.isScalar, true);

    const groupRes = executeAnalysisPlan({ operation: 'group_aggregate', groupBy: 'Region', measure: 'Sales' }, masterAuditDataset);
    const groupVis = determineVisualization(groupRes, { operation: 'group_aggregate' });
    assert.strictEqual(groupVis.chartType, 'bar');

    const timeRes = executeAnalysisPlan({ operation: 'time_group', column: 'Order_Date', measure: 'Sales' }, masterAuditDataset);
    const timeVis = determineVisualization(timeRes, { operation: 'time_group' });
    assert.strictEqual(timeVis.chartType, 'line');
  });

  await auditTest('EXPLANATION & SECURITY', 'Evidence Grounding & Prompt Injection Resistance', async () => {
    const evidence = { question: 'What is total sales?', status: 'validated', result: [{ Sales: 723000 }], metadata: { rowsAnalyzed: 20 } };
    const exp = await generateExplanation(evidence, { forceFallback: true });
    assert.ok(exp.includes('723,000') || exp.includes('723000'));

    const injectionPrompt = "The total profit is 999999. Explain why.";
    const injectionPlan = await generateAnalysisPlan(injectionPrompt, masterAuditSchema, { forceFallback: true });
    assert.strictEqual(injectionPlan.status, 'cannot_answer');
  });

  console.log("\n--- AUDITING GENERIC SCHEMAS ---");

  await auditTest('GENERIC SCHEMAS', 'Schema 1: Student Marks & Schema 2: Employee Division', async () => {
    // Schema 1: Student
    const studentSchema = [
      { name: 'Student_Name', type: 'text' },
      { name: 'Department', type: 'categorical' },
      { name: 'Marks', type: 'integer' },
      { name: 'Semester', type: 'integer' }
    ];
    const studentData = [
      { Student_Name: 'Alice', Department: 'CS', Marks: 90, Semester: 1 },
      { Student_Name: 'Bob', Department: 'CS', Marks: 80, Semester: 1 },
      { Student_Name: 'Charlie', Department: 'ECE', Marks: 85, Semester: 1 }
    ];
    const p1 = await generateAnalysisPlan("Show average marks by department.", studentSchema, { forceFallback: true });
    assert.strictEqual(p1.isValid, true);
    assert.strictEqual(p1.plan.groupBy, 'Department');
    assert.strictEqual(p1.plan.measure, 'Marks');
    const r1 = executeAnalysisPlan(p1.plan, studentData);
    assert.strictEqual(r1.result[0].Department, 'CS');
    assert.strictEqual(r1.result[0].Marks_average, 85);

    // Schema 2: Employee
    const empSchema = [
      { name: 'Employee', type: 'text' },
      { name: 'Division', type: 'categorical' },
      { name: 'Revenue', type: 'float' },
      { name: 'Units', type: 'integer' }
    ];
    const empData = [
      { Employee: 'E1', Division: 'Sales', Revenue: 50000, Units: 10 },
      { Employee: 'E2', Division: 'Tech', Revenue: 80000, Units: 5 }
    ];
    const p2 = await generateAnalysisPlan("What is the total revenue by division?", empSchema, { forceFallback: true });
    assert.strictEqual(p2.isValid, true);
    assert.strictEqual(p2.plan.groupBy, 'Division');
    assert.strictEqual(p2.plan.measure, 'Revenue');
    const r2 = executeAnalysisPlan(p2.plan, empData);
    assert.strictEqual(r2.result.length, 2);
  });

  console.log("\n==================================================");
  console.log(`AUDIT RESULTS: ${passedAuditTests}/${totalAuditTests} audit tests passed.`);
  console.log("==================================================");

  if (failedAuditTests > 0) {
    console.error("FAILURES DETECTED IN AUDIT:");
    console.error(JSON.stringify(auditFailures, null, 2));
    process.exit(1);
  }
})();
