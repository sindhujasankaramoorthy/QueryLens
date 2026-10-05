const assert = require('assert');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { parseDataset } = require('../src/services/parser');
const { profileDataset, calculateNumericalStats } = require('../src/services/profiler');

console.log('--- RUNNING PSA01 PHASE 1 TEST SUITE ---');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
  }
}

// 1. Numerical Statistics Calculation
runTest('Numerical Statistics Math Correctness', () => {
  const numbers = [10, 20, 30, 40, 50];
  const stats = calculateNumericalStats(numbers);
  
  assert.strictEqual(stats.count, 5);
  assert.strictEqual(stats.mean, 30);
  assert.strictEqual(stats.median, 30);
  assert.strictEqual(stats.min, 10);
  assert.strictEqual(stats.max, 50);
  // Sample std dev for [10, 20, 30, 40, 50] is sqrt(250) ≈ 15.8114
  assert.strictEqual(stats.std, 15.8114);
});

// 2. CSV Parsing and Profiling
runTest('CSV Dataset Upload, Parsing & Profiling', () => {
  const csvContent = `id,name,score,department
1,Alice,85.5,Engineering
2,Bob,92.0,Marketing
3,Charlie,78.0,Engineering
4,David,92.0,Design
5,Eva,,Engineering`;

  const buffer = Buffer.from(csvContent, 'utf-8');
  const parsed = parseDataset(buffer, 'test_employees.csv');
  assert.strictEqual(parsed.fileType, 'csv');
  assert.strictEqual(parsed.rows.length, 5);
  assert.strictEqual(parsed.columns.length, 4);

  const profile = profileDataset(parsed);
  assert.strictEqual(profile.dataset.rowCount, 5);
  assert.strictEqual(profile.dataset.columnCount, 4);

  const scoreCol = profile.columns.find(c => c.name === 'score');
  assert.ok(scoreCol);
  assert.strictEqual(scoreCol.type, 'float');
  assert.strictEqual(scoreCol.missingCount, 1);
  assert.strictEqual(scoreCol.missingPercentage, 0.2); // 1 / 5 = 0.20
  assert.strictEqual(scoreCol.statistics.count, 4);
  assert.strictEqual(scoreCol.statistics.min, 78);
  assert.strictEqual(scoreCol.statistics.max, 92);

  const deptCol = profile.columns.find(c => c.name === 'department');
  assert.ok(deptCol);
  assert.strictEqual(deptCol.type, 'categorical');
  assert.strictEqual(deptCol.uniqueCount, 3);
});

// 3. Excel Parsing & Profiling
runTest('XLSX Dataset Parsing & Profiling', () => {
  const wsData = [
    { Product: 'Widget A', Sales: 100, Region: 'North' },
    { Product: 'Widget B', Sales: 250, Region: 'South' },
    { Product: 'Widget C', Sales: 150, Region: 'North' }
  ];
  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SalesData');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const parsed = parseDataset(buffer, 'sales_report.xlsx');
  assert.strictEqual(parsed.fileType, 'xlsx');
  assert.strictEqual(parsed.rows.length, 3);

  const profile = profileDataset(parsed);
  assert.strictEqual(profile.dataset.rowCount, 3);
  assert.strictEqual(profile.dataset.columnCount, 3);
  
  const salesCol = profile.columns.find(c => c.name === 'Sales');
  assert.strictEqual(salesCol.type, 'integer');
  assert.strictEqual(salesCol.statistics.mean, 166.6667);
});

// 4. JSON Dataset Parsing & Profiling
runTest('JSON Dataset Parsing & Profiling', () => {
  const jsonData = [
    { sensorId: 'S1', temperature: 22.4, status: 'active' },
    { sensorId: 'S2', temperature: 24.1, status: 'active' },
    { sensorId: 'S3', temperature: null, status: 'inactive' }
  ];
  const buffer = Buffer.from(JSON.stringify(jsonData), 'utf-8');

  const parsed = parseDataset(buffer, 'sensors.json');
  assert.strictEqual(parsed.fileType, 'json');
  assert.strictEqual(parsed.rows.length, 3);

  const profile = profileDataset(parsed);
  const tempCol = profile.columns.find(c => c.name === 'temperature');
  assert.strictEqual(tempCol.missingCount, 1);
  assert.strictEqual(tempCol.type, 'float');
});

// 5. Duplicate Row Detection
runTest('Duplicate Row Detection', () => {
  const csvData = `city,country
Paris,France
London,UK
Paris,France
Tokyo,Japan
London,UK`;
  const buffer = Buffer.from(csvData, 'utf-8');
  const parsed = parseDataset(buffer, 'cities.csv');
  const profile = profileDataset(parsed);

  assert.strictEqual(profile.duplicates.count, 2);
  assert.strictEqual(profile.duplicates.percentage, 0.4); // 2 / 5 = 0.40
  const dupWarning = profile.warnings.find(w => w.type === 'duplicate_rows');
  assert.ok(dupWarning);
});

// 6. Date Column Detection & Ambiguity Warning
runTest('Date Column Type Inference & Ambiguity Warning', () => {
  const csvData = `event_date,timestamp
2025-01-15,2025-01-15T14:30:00Z
01/02/2025,2025-01-16T09:15:00Z
2025-01-17,2025-01-17T18:00:00Z`;
  const buffer = Buffer.from(csvData, 'utf-8');
  const parsed = parseDataset(buffer, 'dates.csv');
  const profile = profileDataset(parsed);

  const dateCol = profile.columns.find(c => c.name === 'event_date');
  assert.strictEqual(dateCol.type, 'date');

  const timeCol = profile.columns.find(c => c.name === 'timestamp');
  assert.strictEqual(timeCol.type, 'datetime');

  const dateAmbiguityWarn = profile.warnings.find(w => w.type === 'date_ambiguity');
  assert.ok(dateAmbiguityWarn);
  assert.strictEqual(dateAmbiguityWarn.column, 'event_date');
});

// 7. Error Handling for Unsupported or Malformed Files
runTest('Error Handling for Unsupported & Corrupted Files', () => {
  // Empty file error
  assert.throws(() => {
    parseDataset(Buffer.from(''), 'empty.csv');
  }, /empty/i);

  // Unsupported file extension
  assert.throws(() => {
    parseDataset(Buffer.from('test data'), 'file.pdf');
  }, /Unsupported/i);

  // Malformed JSON
  assert.throws(() => {
    parseDataset(Buffer.from('{ bad json: '), 'corrupt.json');
  }, /Failed to parse JSON/i);
});

console.log(`\nTEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
