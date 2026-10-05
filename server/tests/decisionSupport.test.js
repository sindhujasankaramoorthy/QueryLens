/**
 * Phase 15 — Decision Support, Executive Summary, Report Generation & Final Regression Test Suite
 */

const assert = require('assert');
const { generateAnalysisPlan } = require('../src/services/llmPlanner');
const { validateAnalysisPlan } = require('../src/services/planValidator');
const { executeAnalysisPlan } = require('../src/services/analysisEngine');
const { profileDataset } = require('../src/services/profiler');
const { generateDecisionSupport, generateExecutiveSummary, generateAnalysisReport } = require('../src/services/decisionSupport');

const sampleSchema = [
  { name: 'Order_ID', type: 'integer', semanticType: 'identifier' },
  { name: 'Order_Date', type: 'date', semanticType: 'datetime' },
  { name: 'Region', type: 'categorical', semanticType: 'categorical' },
  { name: 'Product', type: 'categorical', semanticType: 'categorical' },
  { name: 'Category', type: 'categorical', semanticType: 'categorical' },
  { name: 'Sales', type: 'float', semanticType: 'measure' },
  { name: 'Quantity', type: 'integer', semanticType: 'measure' },
  { name: 'Customer_Rating', type: 'float', semanticType: 'measure' }
];

const sampleDataset = [
  // Sept 2026
  { Order_ID: 1001, Order_Date: '2026-09-15', Region: 'South', Product: 'Laptop', Category: 'Electronics', Sales: 500000, Quantity: 50, Customer_Rating: 4.5 },
  { Order_ID: 1002, Order_Date: '2026-09-15', Region: 'North', Product: 'Phone', Category: 'Electronics', Sales: 400000, Quantity: 40, Customer_Rating: 4.6 },
  { Order_ID: 1003, Order_Date: '2026-09-15', Region: 'East', Product: 'Desk', Category: 'Furniture', Sales: 300000, Quantity: 30, Customer_Rating: 4.4 },

  // Oct 2026
  { Order_ID: 1004, Order_Date: '2026-10-15', Region: 'South', Product: 'Laptop', Category: 'Electronics', Sales: 200000, Quantity: 20, Customer_Rating: 3.5 },
  { Order_ID: 1005, Order_Date: '2026-10-15', Region: 'North', Product: 'Phone', Category: 'Electronics', Sales: 380000, Quantity: 38, Customer_Rating: 4.5 },
  { Order_ID: 1006, Order_Date: '2026-10-15', Region: 'East', Product: 'Desk', Category: 'Furniture', Sales: 310000, Quantity: 31, Customer_Rating: 4.5 }
];

async function runPhase15Tests() {
  console.log('\n==================================================');
  console.log('     PHASE 15 DECISION SUPPORT & FINAL REGRESSION');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assertTrue(cond, msg) {
    total++;
    if (cond) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✕ FAIL: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }

  const profile = profileDataset(sampleDataset);

  // 15.10 FINAL REGRESSION TEST 1: "Show monthly sales over time."
  {
    const q = "Show monthly sales over time.";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && (planRes.plan.operation === 'time_series' || planRes.plan.operation === 'time_group'), 'Test 1 - Plan generated for trend analysis');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 1 - Engine execution success');

    const ds = generateDecisionSupport(execRes);
    assertTrue(ds.analysisType === 'trend', 'Test 1 - Decision support type is trend');
    assertTrue(ds.finding.includes('trend'), 'Test 1 - Finding summarizes trend regression');
  }

  // 15.10 FINAL REGRESSION TEST 2: "What is the correlation between Sales and Customer_Rating?"
  {
    const q = "What is the correlation between Sales and Customer_Rating?";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && planRes.plan.operation === 'correlation', 'Test 2 - Plan generated for Pearson correlation');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 2 - Correlation computed deterministically');

    const ds = generateDecisionSupport(execRes);
    assertTrue(ds.analysisType === 'correlation', 'Test 2 - Decision support type is correlation');
    assertTrue(ds.disclaimers.some(d => d.includes('Correlation does not imply causation')), 'Test 2 - Mandatory non-causal disclaimer present');
  }

  // 15.10 FINAL REGRESSION TEST 3: "Find anomalies in the dataset."
  {
    const q = "Find anomalies in the dataset.";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && planRes.plan.operation === 'anomaly_detection', 'Test 3 - Plan generated for IQR anomaly detection');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 3 - IQR outlier detection executed');

    const ds = generateDecisionSupport(execRes);
    assertTrue(ds.analysisType === 'anomaly', 'Test 3 - Decision support type is anomaly');
    assertTrue(!ds.finding.includes('fraud') && !ds.finding.includes('error'), 'Test 3 - Refers to records as Statistical Outliers without claiming fraud/error');
  }

  // 15.10 FINAL REGRESSION TEST 4: "Forecast monthly sales for the next 3 months."
  {
    const q = "Forecast monthly sales for the next 3 months.";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && planRes.plan.operation === 'forecast', 'Test 4 - Plan generated for forecasting');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 4 - Forecasting executed');

    const ds = generateDecisionSupport(execRes);
    assertTrue(ds.analysisType === 'forecast', 'Test 4 - Decision support type is forecast');
    assertTrue(ds.finding.includes('projects'), 'Test 4 - Uses non-absolute projected wording');
    assertTrue(ds.disclaimers.some(d => d.includes('do not guarantee future forecast accuracy')), 'Test 4 - Forecast uncertainty disclaimer present');
  }

  // 15.10 FINAL REGRESSION TEST 5: "Why did sales decrease in October 2026?"
  {
    const q = "Why did sales decrease in October 2026?";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && planRes.plan.operation === 'insight_analysis', 'Test 5 - Plan correctly routed to Phase 13 insight_analysis');
    assertTrue(planRes.plan.target_period === '2026-10', 'Test 5 - Target period correctly set to 2026-10');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 5 - Root-cause analysis executed');
    assertTrue(execRes.metadata.comparisonPeriod === '2026-09', 'Test 5 - Baseline comparison period set to 2026-09');

    const ds = generateDecisionSupport(execRes);
    assertTrue(ds.analysisType === 'root_cause', 'Test 5 - Decision support type is root_cause');
    assertTrue(ds.disclaimers.some(d => d.includes('should not be added across dimensions')), 'Test 5 - Non-additive dimensions disclaimer present');
  }

  // 15.10 FINAL REGRESSION TEST 6: "Show sales by region."
  {
    const q = "Show sales by region.";
    const planRes = await generateAnalysisPlan(q, sampleSchema, { forceFallback: true });
    assertTrue(planRes.isValid && planRes.plan.operation === 'group_aggregate', 'Test 6 - Plan generated for group_aggregate');

    const execRes = executeAnalysisPlan(planRes.plan, sampleDataset);
    assertTrue(execRes.status === 'success', 'Test 6 - Group aggregate executed');
    assertTrue(execRes.result[0].Region === 'North', 'Test 6 - North has highest Sales sum (780,000)');
  }

  // 15.4 EXECUTIVE SUMMARY & SAFETY WARNING TEST
  {
    const warningQualitySummary = {
      overallStatus: 'WARNING',
      statusMessage: 'Data Quality Status: WARNING — Minor data-quality issues detected. Analysis can proceed with appropriate handling.'
    };
    const summary = generateExecutiveSummary(profile, warningQualitySummary, []);
    assertTrue(summary.dataQuality.status === 'WARNING', 'Executive Summary Data Quality Status is WARNING');
    assertTrue(!summary.dataQuality.message.includes('Clean Dataset: No major'), 'Executive Summary NEVER displays "Clean Dataset" when status is WARNING');
  }

  // 15.6 ANALYSIS REPORT TEST
  {
    const report = generateAnalysisReport(profile, { overallStatus: 'CLEAN' }, []);
    assertTrue(report.title !== undefined, 'Report contains title');
    assertTrue(report.traceabilityMatrix.calculatedResults.includes('100% deterministically'), 'Report traceability matrix preserves deterministic distinction');
  }

  console.log(`\nPHASE 15 TEST RESULTS: ${passed}/${total} tests passed.\n`);
}

if (require.main === module) {
  runPhase15Tests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runPhase15Tests };
