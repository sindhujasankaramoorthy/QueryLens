/**
 * Deterministic Analysis Engine for PSA01 (Phase 3)
 * Executes validated analysis plans against the raw uploaded dataset rows.
 * Uses pure JavaScript calculations without eval, SQL, or arbitrary code execution.
 */

function isMissingValue(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return true;
    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === 'nan' || lower === 'n/a' || lower === 'none') {
      return true;
    }
  }
  return false;
}

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  return NaN;
}

/**
 * Case-insensitive & trimmed cell value accessor for dataset row objects
 */
function getCellValue(row, colName) {
  if (!row || !colName) return undefined;
  if (colName in row) return row[colName];

  const trimmed = String(colName).trim();
  if (trimmed in row) return row[trimmed];

  const lowerCol = trimmed.toLowerCase();
  const keys = Object.keys(row);
  const matchedKey = keys.find(k => k.trim().toLowerCase() === lowerCol);
  if (matchedKey) return row[matchedKey];

  return undefined;
}

/**
 * Filter rows using controlled comparison operators (No eval)
 */
function filterRows(rows, filters) {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return rows;
  }

  return rows.filter(row => {
    return filters.every(f => {
      const colName = f.column;
      if (!colName) return true;
      const rawVal = getCellValue(row, colName);
      const targetVal = f.value;
      const op = f.operator || '=';

      if (isMissingValue(rawVal)) return false;

      const numVal = parseNumber(rawVal);
      const numTarget = parseNumber(targetVal);
      const isNumericComp = !isNaN(numVal) && !isNaN(numTarget);

      switch (op) {
        case '=':
        case '==':
          return isNumericComp ? numVal === numTarget : String(rawVal).trim().toLowerCase() === String(targetVal).trim().toLowerCase();
        case '!=':
          return isNumericComp ? numVal !== numTarget : String(rawVal).trim().toLowerCase() !== String(targetVal).trim().toLowerCase();
        case '>':
          return isNumericComp ? numVal > numTarget : String(rawVal) > String(targetVal);
        case '>=':
          return isNumericComp ? numVal >= numTarget : String(rawVal) >= String(targetVal);
        case '<':
          return isNumericComp ? numVal < numTarget : String(rawVal) < String(targetVal);
        case '<=':
          return isNumericComp ? numVal <= numTarget : String(rawVal) <= String(targetVal);
        case 'contains':
          return String(rawVal).toLowerCase().includes(String(targetVal).toLowerCase());
        default:
          return true;
      }
    });
  });
}

/**
 * Helper to extract valid numeric values and missing count
 */
function extractNumericArray(rows, colName) {
  let missingCount = 0;
  const numbers = [];

  rows.forEach(row => {
    const val = getCellValue(row, colName);
    if (isMissingValue(val)) {
      missingCount++;
    } else {
      const num = parseNumber(val);
      if (!isNaN(num)) {
        numbers.push(num);
      } else {
        missingCount++;
      }
    }
  });

  return { numbers, missingCount };
}

/**
 * Robust date parser supporting Date objects, ISO strings, slash formats, and Excel date serials
 */
function parseDateValue(val) {
  if (isMissingValue(val)) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Handle Excel serial date numbers (e.g. 45000 is ~2023)
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{5}(\.\d+)?$/.test(val.trim()))) {
    const num = Number(val);
    if (num > 25000 && num < 100000) {
      const dateMs = (num - 25569) * 86400 * 1000;
      const d = new Date(dateMs);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return null;

    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Slash format DD/MM/YYYY or MM/DD/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);
      const month = p1 > 12 ? p2 : p1;
      const day = p1 > 12 ? p1 : p2;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }

    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

/**
 * Format date values to standardized time grouping keys
 */
function getTimeGroupKey(val, timeUnit = 'month') {
  const d = parseDateValue(val);
  if (!d) return 'Unknown Date';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  switch (timeUnit.toLowerCase()) {
    case 'year':
      return `${year}`;
    case 'quarter':
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `${year}-Q${q}`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    case 'month':
    default:
      return `${year}-${month}`;
  }
}

/**
 * Helper to compute correlation strength and direction according to Phase 10 rules
 */
function getCorrelationStrengthAndDirection(r) {
  const absR = Math.abs(r);
  let strength = 'Very Weak';
  if (absR >= 0.80) {
    strength = 'Very Strong';
  } else if (absR >= 0.60) {
    strength = 'Strong';
  } else if (absR >= 0.40) {
    strength = 'Moderate';
  } else if (absR >= 0.20) {
    strength = 'Weak';
  } else {
    strength = 'Very Weak';
  }

  let direction = 'No linear relationship';
  if (r > 0) {
    direction = 'Positive';
  } else if (r < 0) {
    direction = 'Negative';
  }

  return { strength, direction, absR };
}

/**
 * Helper to compute pairwise Pearson correlation between two numerical columns
 */
function computePairwiseCorrelation(rows, colX, colY) {
  let missingPairsExcluded = 0;
  const pairs = [];

  rows.forEach(row => {
    const valX = getCellValue(row, colX);
    const valY = getCellValue(row, colY);

    if (isMissingValue(valX) || isMissingValue(valY)) {
      missingPairsExcluded++;
      return;
    }

    const numX = parseNumber(valX);
    const numY = parseNumber(valY);

    if (isNaN(numX) || isNaN(numY)) {
      missingPairsExcluded++;
      return;
    }

    pairs.push({ x: numX, y: numY });
  });

  const observations = pairs.length;
  if (observations < 2) {
    return {
      status: 'insufficient_data',
      message: 'Correlation cannot be reliably calculated because there are insufficient valid paired observations.',
      observations,
      missingPairsExcluded
    };
  }

  const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / observations;
  const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / observations;

  let sumCov = 0;
  let sumVarX = 0;
  let sumVarY = 0;

  pairs.forEach(p => {
    const diffX = p.x - meanX;
    const diffY = p.y - meanY;
    sumCov += diffX * diffY;
    sumVarX += diffX * diffX;
    sumVarY += diffY * diffY;
  });

  if (sumVarX === 0 || sumVarY === 0) {
    return {
      status: 'zero_variance',
      message: 'Correlation undefined because one variable has zero variance.',
      observations,
      missingPairsExcluded
    };
  }

  let r = sumCov / (Math.sqrt(sumVarX) * Math.sqrt(sumVarY));
  if (r > 1) r = 1;
  if (r < -1) r = -1;

  const rFormatted = Number(r.toFixed(4));
  const classification = getCorrelationStrengthAndDirection(r);

  return {
    status: 'success',
    r,
    rFormatted,
    rDisplay: (r >= 0 ? '+' : '') + r.toFixed(2),
    observations,
    missingPairsExcluded,
    pairs,
    ...classification
  };
}

/**
 * Deterministic Pseudo-Random Number Generator (PRNG) seeded with seed = 42
 */
function createSeededRandom(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Average path length of unsuccessful search in BST
 */
function calculateC(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const eulerConstant = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerConstant) - (2 * (n - 1) / n);
}

/**
 * Recursive Isolation Tree Builder
 */
function buildITree(matrix, currentDepth, maxDepth, rng) {
  const n = matrix.length;
  if (currentDepth >= maxDepth || n <= 1) {
    return { isLeaf: true, size: n };
  }

  const numFeatures = matrix[0].length;
  let allIdentical = true;
  for (let f = 0; f < numFeatures; f++) {
    const val0 = matrix[0][f];
    for (let i = 1; i < n; i++) {
      if (matrix[i][f] !== val0) {
        allIdentical = false;
        break;
      }
    }
    if (!allIdentical) break;
  }
  if (allIdentical) {
    return { isLeaf: true, size: n };
  }

  const featureIndices = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = featureIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [featureIndices[i], featureIndices[j]] = [featureIndices[j], featureIndices[i]];
  }

  let selectedFeature = -1;
  let minVal = 0;
  let maxVal = 0;

  for (const f of featureIndices) {
    let minF = Infinity;
    let maxF = -Infinity;
    for (let i = 0; i < n; i++) {
      const val = matrix[i][f];
      if (val < minF) minF = val;
      if (val > maxF) maxF = val;
    }
    if (minF < maxF) {
      selectedFeature = f;
      minVal = minF;
      maxVal = maxF;
      break;
    }
  }

  if (selectedFeature === -1) {
    return { isLeaf: true, size: n };
  }

  const splitValue = minVal + rng() * (maxVal - minVal);
  const left = [];
  const right = [];

  for (let i = 0; i < n; i++) {
    if (matrix[i][selectedFeature] < splitValue) {
      left.push(matrix[i]);
    } else {
      right.push(matrix[i]);
    }
  }

  return {
    isLeaf: false,
    featureIndex: selectedFeature,
    splitValue,
    left: buildITree(left, currentDepth + 1, maxDepth, rng),
    right: buildITree(right, currentDepth + 1, maxDepth, rng)
  };
}

/**
 * Compute path length for a single observation in an Isolation Tree
 */
function computePathLength(x, node, currentDepth) {
  if (node.isLeaf) {
    return currentDepth + calculateC(node.size);
  }
  if (x[node.featureIndex] < node.splitValue) {
    return computePathLength(x, node.left, currentDepth + 1);
  } else {
    return computePathLength(x, node.right, currentDepth + 1);
  }
}

/**
 * Main Isolation Forest Algorithm Execution
 */
function runIsolationForest(matrix, numTrees = 100, subSampleSize = 256, seed = 42) {
  const N = matrix.length;
  if (N < 2) {
    return { scores: N === 1 ? [0.5] : [], sampleSize: N };
  }

  const rng = createSeededRandom(seed);
  const sampleSize = Math.min(subSampleSize, N);
  const maxDepth = Math.ceil(Math.log2(sampleSize));

  const trees = [];
  for (let t = 0; t < numTrees; t++) {
    const indices = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > N - 1 - sampleSize; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const sample = indices.slice(N - sampleSize).map(idx => matrix[idx]);
    trees.push(buildITree(sample, 0, maxDepth, rng));
  }

  const cN = calculateC(sampleSize);
  const scores = [];

  for (let i = 0; i < N; i++) {
    const x = matrix[i];
    let totalPath = 0;
    for (let t = 0; t < numTrees; t++) {
      totalPath += computePathLength(x, trees[t], 0);
    }
    const avgPath = totalPath / numTrees;
    const score = cN > 0 ? Math.pow(2, -avgPath / cN) : 0.5;
    scores.push(score);
  }

  return { scores, sampleSize, cN };
}

/**
 * Main Deterministic Plan Execution Function
 */
function executeAnalysisPlan(plan, rows) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Analysis plan must be a valid plan object.');
  }

  if (!rows || !Array.isArray(rows)) {
    throw new Error('Dataset rows array is required for analysis execution.');
  }

  // Step 1: Apply validated filters if present
  const filteredRows = filterRows(rows, plan.filters);
  const rowsAnalyzed = filteredRows.length;
  const operation = (plan.operation || '').toLowerCase().trim();

  let columnsUsed = [];
  if (plan.groupBy) columnsUsed.push(plan.groupBy);
  if (plan.measure && !columnsUsed.includes(plan.measure)) columnsUsed.push(plan.measure);
  if (plan.column && !columnsUsed.includes(plan.column)) columnsUsed.push(plan.column);

  let resultData = [];
  let missingValuesIgnored = 0;

  switch (operation) {
    case 'count': {
      const colName = plan.measure || plan.column;
      if (colName) {
        const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
        missingValuesIgnored = missingCount;
        resultData = [{ count: numbers.length }];
      } else {
        resultData = [{ count: rowsAnalyzed }];
      }
      break;
    }

    case 'sum': {
      const colName = plan.measure || plan.column;
      if (!colName) throw new Error('Sum operation requires a measure column.');
      const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
      missingValuesIgnored = missingCount;
      const sum = numbers.reduce((acc, curr) => acc + curr, 0);
      resultData = [{ [colName]: Number(sum.toFixed(4)) }];
      break;
    }

    case 'average': {
      const colName = plan.measure || plan.column;
      if (!colName) throw new Error('Average operation requires a measure column.');
      const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
      missingValuesIgnored = missingCount;
      const avg = numbers.length > 0 ? numbers.reduce((acc, curr) => acc + curr, 0) / numbers.length : 0;
      resultData = [{ [colName]: Number(avg.toFixed(4)) }];
      break;
    }

    case 'median': {
      const colName = plan.measure || plan.column;
      if (!colName) throw new Error('Median operation requires a measure column.');
      const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
      missingValuesIgnored = missingCount;

      let median = 0;
      if (numbers.length > 0) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
          median = (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
          median = sorted[mid];
        }
      }
      resultData = [{ [colName]: Number(median.toFixed(4)) }];
      break;
    }

    case 'min': {
      const colName = plan.measure || plan.column;
      if (!colName) throw new Error('Min operation requires a measure column.');
      const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
      missingValuesIgnored = missingCount;
      const minVal = numbers.length > 0 ? Math.min(...numbers) : 0;
      resultData = [{ [colName]: Number(minVal.toFixed(4)) }];
      break;
    }

    case 'max': {
      const colName = plan.measure || plan.column;
      if (!colName) throw new Error('Max operation requires a measure column.');
      const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
      missingValuesIgnored = missingCount;
      const maxVal = numbers.length > 0 ? Math.max(...numbers) : 0;
      resultData = [{ [colName]: Number(maxVal.toFixed(4)) }];
      break;
    }

    case 'top_n':
    case 'bottom_n':
    case 'group_aggregate': {
      const groupBy = plan.groupBy;
      const measure = plan.measure;
      const agg = (plan.aggregation || 'sum').toLowerCase();

      if (!groupBy) throw new Error('Group aggregate operation requires a groupBy column.');

      // Group rows by categorical key
      const groupsMap = new Map();

      filteredRows.forEach(row => {
        const rawGroupKey = getCellValue(row, groupBy);
        const groupKey = isMissingValue(rawGroupKey) ? 'Unknown' : String(rawGroupKey).trim();
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }

        if (measure) {
          const mVal = getCellValue(row, measure);
          if (!isMissingValue(mVal)) {
            const num = parseNumber(mVal);
            if (!isNaN(num)) {
              groupsMap.get(groupKey).push(num);
            } else {
              missingValuesIgnored++;
            }
          } else {
            missingValuesIgnored++;
          }
        } else {
          groupsMap.get(groupKey).push(1);
        }
      });

      // Compute aggregates per group
      const aggregatedList = [];
      groupsMap.forEach((values, groupKey) => {
        let aggValue = 0;
        if (agg === 'sum') {
          aggValue = values.reduce((acc, curr) => acc + curr, 0);
        } else if (agg === 'average') {
          aggValue = values.length > 0 ? values.reduce((acc, curr) => acc + curr, 0) / values.length : 0;
        } else if (agg === 'median') {
          if (values.length > 0) {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggValue = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          }
        } else if (agg === 'min') {
          aggValue = values.length > 0 ? Math.min(...values) : 0;
        } else if (agg === 'max') {
          aggValue = values.length > 0 ? Math.max(...values) : 0;
        } else if (agg === 'count') {
          aggValue = values.length;
        }

        const measureLabel = measure ? `${measure}_${agg}` : 'count';
        aggregatedList.push({
          [groupBy]: groupKey,
          [measureLabel]: Number(aggValue.toFixed(4))
        });
      });

      // Sort results
      const measureLabel = measure ? `${measure}_${agg}` : 'count';
      const sortDir = plan.sort || (operation === 'bottom_n' ? 'ascending' : 'descending');

      aggregatedList.sort((a, b) => {
        return sortDir === 'ascending' ? a[measureLabel] - b[measureLabel] : b[measureLabel] - a[measureLabel];
      });

      // Apply limit
      let limit = plan.limit;
      if (!limit && (operation === 'top_n' || operation === 'bottom_n')) {
        limit = 5;
      }

      resultData = limit ? aggregatedList.slice(0, limit) : aggregatedList;
      break;
    }

/**
 * Statistically Reliable Simple Linear Regression Trend Analysis
 * Fits y = mx + b over 1-indexed chronological period indices x = 1..N.
 * Computes slope (m), relative slope (m / mean(y)), and R² coefficient of determination.
 */
function calculateLinearTrend(points, granularity = 'MONTH') {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      trendDirection: 'Insufficient Data',
      slope: 0,
      relativeSlope: 0,
      r2: 0,
      sampleCount: 0,
      trendMethod: 'Insufficient data points to compute regression trend.'
    };
  }

  // Filter out invalid or missing numerical values
  const validPoints = points.filter(p => p && typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y));
  const N = validPoints.length;

  if (N < 2) {
    return {
      trendDirection: 'Insufficient Data',
      slope: 0,
      relativeSlope: 0,
      r2: 0,
      sampleCount: N,
      trendMethod: 'At least 2 valid chronological periods are required to compute regression trend.'
    };
  }

  // Use 1-indexed integer chronological period indices: x = 1, 2, ..., N
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  validPoints.forEach((p, i) => {
    const x = i + 1;
    const y = p.y;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const meanX = sumX / N;
  const meanY = sumY / N;

  const denom = N * sumX2 - sumX * sumX;
  const m = denom !== 0 ? (N * sumXY - sumX * sumY) / denom : 0;
  const b = meanY - m * meanX;

  // Calculate R² (Coefficient of Determination)
  let sst = 0;
  let sse = 0;

  validPoints.forEach((p, i) => {
    const x = i + 1;
    const y = p.y;
    const yFit = m * x + b;
    sst += (y - meanY) * (y - meanY);
    sse += (y - yFit) * (y - yFit);
  });

  let r2 = 0;
  if (sst === 0) {
    // Zero variance (all y values identical): horizontal line fits data perfectly
    r2 = 1.0;
  } else {
    r2 = Math.max(0, Math.min(1, 1 - (sse / sst)));
  }

  // Calculate relative slope = slope / mean(y)
  let relativeSlope = 0;
  if (meanY !== 0) {
    relativeSlope = m / Math.abs(meanY);
  } else if (m !== 0) {
    relativeSlope = Math.sign(m);
  }

  // Trend Classification based on relative slope threshold of 0.005 (0.5% per period)
  let trendDirection = 'Stable';
  if (Math.abs(relativeSlope) < 0.005) {
    trendDirection = 'Stable';
  } else if (relativeSlope > 0) {
    trendDirection = 'Increasing';
  } else {
    trendDirection = 'Decreasing';
  }

  const slopeFormatted = Number(m.toFixed(2));
  const relSlopePercent = Number((relativeSlope * 100).toFixed(2));
  const r2Formatted = Number(r2.toFixed(2));

  const slopeStr = m >= 0 ? `+${m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const relSlopeStr = relativeSlope >= 0 ? `+${relSlopePercent}%` : `${relSlopePercent}%`;

  const confNote = N === 2 ? ' (Note: 2 periods evaluate line fit with low statistical confidence)' : '';
  const trendMethod = `Linear regression (y = ${slopeStr}x + ${b.toFixed(2)}, relative slope = ${relSlopeStr}/period, R² = ${r2Formatted}) across ${N} chronological periods${confNote}.`;

  return {
    trendDirection,
    slope: slopeFormatted,
    relativeSlope: relSlopePercent,
    rawRelativeSlope: relativeSlope,
    r2: r2Formatted,
    trendMethod,
    sampleCount: N,
    isLowConfidence: N === 2
  };
}

    case 'time_series':
    case 'time_group': {
      const dateCol = plan.date_column || plan.column || plan.groupBy;
      const measure = plan.measure;
      const groupBy = plan.groupBy || plan.group_by;
      const granularity = (plan.granularity || plan.timeUnit || 'MONTH').toUpperCase();
      const agg = (plan.aggregation || 'sum').toLowerCase();

      if (!dateCol) throw new Error('Time-series analysis requires a date column.');

      let invalidDatesExcluded = 0;
      const timeGroupDataMap = new Map();

      filteredRows.forEach(row => {
        const rawDate = getCellValue(row, dateCol);
        const parsedD = parseDateValue(rawDate);

        if (!parsedD) {
          invalidDatesExcluded++;
          return;
        }

        const dateKey = getTimeGroupKey(parsedD, granularity);
        const groupVal = groupBy ? (isMissingValue(getCellValue(row, groupBy)) ? 'Unknown' : String(getCellValue(row, groupBy)).trim()) : '__ALL__';

        const compositeKey = `${dateKey}|||${groupVal}`;
        if (!timeGroupDataMap.has(compositeKey)) {
          timeGroupDataMap.set(compositeKey, { dateKey, groupVal, values: [] });
        }

        if (measure) {
          const mVal = getCellValue(row, measure);
          if (!isMissingValue(mVal)) {
            const num = parseNumber(mVal);
            if (!isNaN(num)) {
              timeGroupDataMap.get(compositeKey).values.push(num);
            } else {
              missingValuesIgnored++;
            }
          } else {
            missingValuesIgnored++;
          }
        } else {
          timeGroupDataMap.get(compositeKey).values.push(1);
        }
      });

      // Calculate aggregate per group & date key
      const tempRows = [];
      timeGroupDataMap.forEach(({ dateKey, groupVal, values }) => {
        let aggValue = 0;
        if (agg === 'sum') {
          aggValue = values.reduce((a, b) => a + b, 0);
        } else if (agg === 'average') {
          aggValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        } else if (agg === 'median') {
          if (values.length > 0) {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggValue = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          }
        } else if (agg === 'min') {
          aggValue = values.length > 0 ? Math.min(...values) : 0;
        } else if (agg === 'max') {
          aggValue = values.length > 0 ? Math.max(...values) : 0;
        } else if (agg === 'count') {
          aggValue = values.length;
        }

        tempRows.push({
          dateKey,
          groupVal,
          aggValue: Number(aggValue.toFixed(4)),
          count: values.length
        });
      });

      // Chronological sorting by dateKey
      tempRows.sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));

      // Group rows by groupVal to calculate period-over-period growth per series
      const seriesByGroup = new Map();
      tempRows.forEach(item => {
        if (!seriesByGroup.has(item.groupVal)) {
          seriesByGroup.set(item.groupVal, []);
        }
        seriesByGroup.get(item.groupVal).push(item);
      });

      const finalResults = [];
      const groupedSeriesData = {};

      seriesByGroup.forEach((items, gVal) => {
        let prevVal = null;
        const groupPoints = [];

        const seriesList = [];
        items.forEach((item, idx) => {
          let growthPercent = null;
          if (idx > 0 && prevVal !== null && prevVal !== 0) {
            growthPercent = Number((((item.aggValue - prevVal) / Math.abs(prevVal)) * 100).toFixed(2));
          }
          prevVal = item.aggValue;

          groupPoints.push({ x: idx + 1, y: item.aggValue, dateKey: item.dateKey });

          const measureKey = measure || 'Value';
          const measureAggKey = measure ? `${measure}_${agg}` : 'count';

          const rowObj = {
            [dateCol]: item.dateKey,
            ...(groupBy ? { [groupBy]: gVal } : {}),
            [measureKey]: item.aggValue,
            ...(measureAggKey !== measureKey ? { [measureAggKey]: item.aggValue } : {}),
            'Growth (%)': growthPercent !== null ? growthPercent : '—'
          };

          seriesList.push({
            dateKey: item.dateKey,
            value: item.aggValue,
            growthPercent
          });

          finalResults.push(rowObj);
        });

        if (groupBy) {
          const groupTrend = calculateLinearTrend(groupPoints, granularity);
          groupedSeriesData[gVal] = {
            series: seriesList,
            trendDirection: groupTrend.trendDirection,
            slope: groupTrend.slope,
            relativeSlope: groupTrend.relativeSlope,
            r2: groupTrend.r2,
            trendMethod: groupTrend.trendMethod
          };
        }
      });

      // Overall trend direction on overall aggregate
      const overallPointsMap = new Map();
      tempRows.forEach(row => {
        if (!overallPointsMap.has(row.dateKey)) overallPointsMap.set(row.dateKey, 0);
        overallPointsMap.set(row.dateKey, overallPointsMap.get(row.dateKey) + row.aggValue);
      });

      const sortedOverallKeys = Array.from(overallPointsMap.keys()).sort((a, b) => String(a).localeCompare(String(b)));
      const overallPoints = sortedOverallKeys.map((dateKey, idx) => ({
        x: idx + 1,
        y: overallPointsMap.get(dateKey),
        dateKey
      }));

      const { trendDirection, trendMethod, slope, relativeSlope, r2 } = calculateLinearTrend(overallPoints, granularity);

      resultData = plan.limit ? finalResults.slice(0, plan.limit) : finalResults;

      return {
        status: 'success',
        operation: 'time_series',
        columnsUsed: [dateCol, measure, groupBy].filter(Boolean),
        result: resultData,
        metadata: {
          rowsAnalyzed,
          missingValuesIgnored,
          invalidDatesExcluded,
          dateColumn: dateCol,
          measureColumn: measure,
          granularity,
          aggregation: agg,
          trendDirection,
          trendMethod,
          slope,
          relativeSlope,
          r2,
          groupedSeries: groupBy ? groupedSeriesData : null
        }
      };
    }

    case 'describe': {
      const colName = plan.measure || plan.column;
      if (colName) {
        const { numbers, missingCount } = extractNumericArray(filteredRows, colName);
        missingValuesIgnored = missingCount;
        if (numbers.length > 0) {
          const sum = numbers.reduce((a, b) => a + b, 0);
          const mean = sum / numbers.length;
          const sorted = [...numbers].sort((a, b) => a - b);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          resultData = [{ column: colName, count: numbers.length, mean: Number(mean.toFixed(4)), median: Number(median.toFixed(4)), min, max }];
        }
      } else {
        resultData = [{ totalRows: rowsAnalyzed }];
      }
      break;
    }

    case 'correlation': {
      let colX = plan.column_x || plan.columnX;
      let colY = plan.column_y || plan.columnY;

      if (!colX || !colY) {
        if (Array.isArray(plan.measures) && plan.measures.length >= 2) {
          colX = plan.measures[0];
          colY = plan.measures[1];
        } else if (plan.column && plan.measure) {
          colX = plan.column;
          colY = plan.measure;
        }
      }

      if (!colX || !colY) {
        throw new Error('Correlation analysis requires two numerical measure columns.');
      }

      const calc = computePairwiseCorrelation(filteredRows, colX, colY);

      if (calc.status === 'zero_variance') {
        return {
          status: 'cannot_answer',
          operation: 'correlation',
          reason: 'Correlation undefined because one variable has zero variance.',
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored: calc.missingPairsExcluded }
        };
      }

      if (calc.status === 'insufficient_data') {
        return {
          status: 'cannot_answer',
          operation: 'correlation',
          reason: calc.observations === 0
            ? 'No valid paired observations exist between the selected columns.'
            : 'Correlation cannot be reliably calculated because there are insufficient valid paired observations.',
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored: calc.missingPairsExcluded }
        };
      }

      resultData = [{
        operation: 'correlation',
        method: 'pearson',
        columnX: colX,
        columnY: colY,
        correlation: calc.rFormatted,
        pearsonR: calc.rFormatted,
        rawR: calc.r,
        direction: calc.direction,
        strength: calc.strength,
        rowsAnalyzed,
        missingPairsExcluded: calc.missingPairsExcluded,
        observations: calc.observations
      }];

      if (!columnsUsed.includes(colX)) columnsUsed.push(colX);
      if (!columnsUsed.includes(colY)) columnsUsed.push(colY);

      return {
        status: 'success',
        operation: 'correlation',
        columnsUsed,
        result: resultData,
        metadata: {
          rowsAnalyzed,
          missingValuesIgnored: calc.missingPairsExcluded,
          missingPairsExcluded: calc.missingPairsExcluded,
          method: 'Pearson',
          columnX: colX,
          columnY: colY,
          pearsonR: calc.rFormatted,
          rawR: calc.r,
          direction: calc.direction,
          strength: calc.strength,
          observations: calc.observations,
          scatterPoints: calc.pairs
        }
      };
    }

    case 'correlation_matrix': {
      let cols = Array.isArray(plan.columns) && plan.columns.length > 0 ? plan.columns : [];
      
      // If columns not provided or empty, find all numeric measure columns from rows
      if (cols.length === 0 && filteredRows.length > 0) {
        const sampleRow = filteredRows[0];
        const allKeys = Object.keys(sampleRow);
        cols = allKeys.filter(k => {
          const lower = k.trim().toLowerCase();
          if (lower.includes('id') || lower.includes('code')) return false;
          const val = getCellValue(sampleRow, k);
          const num = parseNumber(val);
          return !isNaN(num);
        });
      }

      if (cols.length < 2) {
        throw new Error('Correlation matrix requires at least two numerical measure columns.');
      }

      const targetCol = plan.target_column || plan.targetColumn || null;

      // Compute pairwise correlations for all combinations
      const matrixMap = {};
      cols.forEach(c => { matrixMap[c] = {}; });

      let maxMissingPairs = 0;
      const pairwiseResults = [];

      for (let i = 0; i < cols.length; i++) {
        for (let j = 0; j < cols.length; j++) {
          const c1 = cols[i];
          const c2 = cols[j];

          if (i === j) {
            matrixMap[c1][c2] = 1.00;
          } else if (i < j) {
            const calc = computePairwiseCorrelation(filteredRows, c1, c2);
            const rVal = calc.status === 'success' ? calc.rFormatted : null;
            matrixMap[c1][c2] = rVal;
            matrixMap[c2][c1] = rVal;

            if (calc.missingPairsExcluded > maxMissingPairs) {
              maxMissingPairs = calc.missingPairsExcluded;
            }

            if (calc.status === 'success') {
              pairwiseResults.push({
                colX: c1,
                colY: c2,
                calc
              });
            }
          }
        }
      }

      // Build tabular matrix display format
      const matrixTableRows = cols.map(c1 => {
        const rowObj = { Variable: c1 };
        cols.forEach(c2 => {
          rowObj[c2] = matrixMap[c1][c2] !== null ? Number(matrixMap[c1][c2].toFixed(2)) : 'N/A';
        });
        return rowObj;
      });

      // Target column factors ranking if requested
      let targetFactors = null;
      if (targetCol && cols.includes(targetCol)) {
        targetFactors = [];
        cols.forEach(c => {
          if (c !== targetCol) {
            const calc = computePairwiseCorrelation(filteredRows, targetCol, c);
            if (calc.status === 'success') {
              targetFactors.push({
                variable: c,
                pearsonR: (calc.r >= 0 ? '+' : '') + calc.r.toFixed(2),
                rawR: calc.r,
                absR: calc.absR,
                direction: calc.direction,
                strength: calc.strength,
                observations: calc.observations,
                missingPairsExcluded: calc.missingPairsExcluded
              });
            }
          }
        });

        // Sort target factors by absolute correlation descending
        targetFactors.sort((a, b) => b.absR - a.absR);
      }

      // Find strongest non-trivial pair for scatter plot representation
      let topPair = null;
      if (pairwiseResults.length > 0) {
        pairwiseResults.sort((a, b) => b.calc.absR - a.calc.absR);
        const top = pairwiseResults[0];
        topPair = {
          columnX: top.colX,
          columnY: top.colY,
          pearsonR: top.calc.rFormatted,
          rawR: top.calc.r,
          direction: top.calc.direction,
          strength: top.calc.strength,
          observations: top.calc.observations,
          missingPairsExcluded: top.calc.missingPairsExcluded,
          scatterPoints: top.calc.pairs
        };
      }

      resultData = matrixTableRows;

      return {
        status: 'success',
        operation: 'correlation_matrix',
        columnsUsed: cols,
        result: resultData,
        metadata: {
          rowsAnalyzed,
          missingValuesIgnored: maxMissingPairs,
          missingPairsExcluded: maxMissingPairs,
          method: 'Pearson',
          columns: cols,
          matrixMap,
          targetColumn: targetCol,
          targetFactors,
          topPair
        }
      };
    }

    case 'anomaly_detection': {
      let features = Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : (plan.columns || []);

      // Filter eligible features from filteredRows
      if (features.length === 0 && filteredRows.length > 0) {
        const sampleRow = filteredRows[0];
        const allKeys = Object.keys(sampleRow);
        features = allKeys.filter(k => {
          const lower = k.trim().toLowerCase();
          if (lower.includes('id') || lower.includes('code')) return false;
          const val = getCellValue(sampleRow, k);
          const num = parseNumber(val);
          return !isNaN(num);
        });
      }

      if (features.length < 2) {
        return {
          status: 'cannot_answer',
          operation: 'anomaly_detection',
          reason: 'For multivariate anomaly detection, at least two eligible numerical measures are required.',
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored: 0 }
        };
      }

      // Feature statistics calculation for contextual evidence
      const featureDistributions = {};
      features.forEach(f => {
        const { numbers } = extractNumericArray(filteredRows, f);
        if (numbers.length > 0) {
          const sorted = [...numbers].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          featureDistributions[f] = { numbers, sorted, median, q1, q3, iqr };
        }
      });

      // Complete case row extraction
      const validRows = [];
      const featureMatrix = [];
      let rowsExcluded = 0;

      filteredRows.forEach(row => {
        let hasMissing = false;
        const rowVector = [];

        for (const f of features) {
          const rawVal = getCellValue(row, f);
          if (isMissingValue(rawVal)) {
            hasMissing = true;
            break;
          }
          const num = parseNumber(rawVal);
          if (isNaN(num)) {
            hasMissing = true;
            break;
          }
          rowVector.push(num);
        }

        if (hasMissing) {
          rowsExcluded++;
        } else {
          validRows.push(row);
          featureMatrix.push(rowVector);
        }
      });

      if (validRows.length < 2) {
        return {
          status: 'cannot_answer',
          operation: 'anomaly_detection',
          reason: 'Insufficient valid observations to run multivariate anomaly detection.',
          result: [],
          metadata: { rowsAnalyzed: validRows.length, rowsExcluded }
        };
      }

      // Run Isolation Forest with fixed random seed 42
      const seed = plan.random_state || plan.randomState || 42;
      const { scores } = runIsolationForest(featureMatrix, 100, 256, seed);

      // Determine classification threshold
      const scoreSum = scores.reduce((a, b) => a + b, 0);
      const scoreMean = scoreSum / scores.length;
      const scoreVariance = scores.reduce((acc, s) => acc + Math.pow(s - scoreMean, 2), 0) / scores.length;
      const scoreStd = Math.sqrt(scoreVariance);

      let threshold = Math.max(0.58, scoreMean + 1.2 * scoreStd);
      const maxScore = Math.max(...scores);
      if (maxScore > 0.54 && threshold > maxScore) {
        threshold = maxScore - 0.001;
      }

      // Construct detailed result objects for each record
      let anomalyCount = 0;
      let normalCount = 0;

      const scoredRows = validRows.map((row, i) => {
        const rawScore = scores[i];
        const isAnomaly = rawScore >= threshold;
        if (isAnomaly) anomalyCount++; else normalCount++;

        // Contextual evidence generation per feature
        const contextParts = [];
        features.forEach((f, fIdx) => {
          const val = featureMatrix[i][fIdx];
          const dist = featureDistributions[f];
          if (dist) {
            if (dist.iqr > 0 && val > dist.q3 + 1.5 * dist.iqr) {
              contextParts.push(`${f} (${val}) is substantially higher than dataset typical range (median: ${Number(dist.median.toFixed(2))})`);
            } else if (dist.iqr > 0 && val < dist.q1 - 1.5 * dist.iqr) {
              contextParts.push(`${f} (${val}) is substantially lower than dataset typical range (median: ${Number(dist.median.toFixed(2))})`);
            }
          }
        });

        const contextStr = contextParts.length > 0 
          ? contextParts.join('; ')
          : `Unusual combination of ${features.join(', ')} relative to dataset distribution`;

        const idCol = Object.keys(row).find(k => k.toLowerCase().includes('id') || k.toLowerCase() === '#') || 'Order_ID';
        const rawId = getCellValue(row, idCol);

        const resultObj = {
          [idCol]: rawId !== undefined ? rawId : i + 1,
          'Anomaly Status': isAnomaly ? 'Anomaly' : 'Normal',
          'Anomaly Score': Number(rawScore.toFixed(4)),
          rawScore,
          isAnomaly
        };

        features.forEach((f, fIdx) => {
          resultObj[f] = featureMatrix[i][fIdx];
        });

        resultObj['Supporting Context'] = contextStr;

        return resultObj;
      });

      // Sort by Anomaly Score descending
      scoredRows.sort((a, b) => b.rawScore - a.rawScore);

      const finalResultData = scoredRows.map(({ rawScore, isAnomaly, ...rest }) => rest);
      resultData = finalResultData;

      const scatterPoints = validRows.map((row, i) => ({
        x: featureMatrix[i][0],
        y: featureMatrix[i][1],
        id: getCellValue(row, 'Order_ID') || i + 1,
        status: scores[i] >= threshold ? 'Anomaly' : 'Normal',
        score: Number(scores[i].toFixed(4))
      }));

      return {
        status: 'success',
        operation: 'anomaly_detection',
        columnsUsed: features,
        result: resultData,
        metadata: {
          operation: 'anomaly_detection',
          method: 'Isolation Forest',
          randomState: seed,
          features,
          totalRecords: rows.length,
          rowsAnalyzed: validRows.length,
          rowsExcluded,
          anomaliesDetected: anomalyCount,
          normalRecords: normalCount,
          anomalyRate: Number(((anomalyCount / validRows.length) * 100).toFixed(2)),
          scatterPoints,
          featureX: features[0],
          featureY: features[1]
        }
      };
    }

    default:
      throw new Error(`Unsupported engine operation '${operation}'.`);
  }

  return {
    status: 'success',
    operation,
    columnsUsed,
    result: resultData,
    metadata: {
      rowsAnalyzed,
      missingValuesIgnored
    }
  };
}

module.exports = {
  executeAnalysisPlan,
  filterRows,
  extractNumericArray,
  getTimeGroupKey
};
