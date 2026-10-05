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
 * Increment formatted date keys for time series forecasting
 */
function incrementDateKey(dateKey, granularity = 'month') {
  if (!dateKey) return dateKey;
  const str = String(dateKey).trim();
  const gran = String(granularity).toLowerCase();

  // YYYY-MM
  if (gran.includes('month') || /^\d{4}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    if (parts.length === 2) {
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // YYYY
  if (gran.includes('year') || /^\d{4}$/.test(str)) {
    let y = parseInt(str, 10);
    if (!isNaN(y)) return `${y + 1}`;
  }

  // YYYY-Q1
  if (gran.includes('quarter') || /^\d{4}-Q[1-4]$/i.test(str)) {
    const match = str.match(/^(\d{4})-Q([1-4])$/i);
    if (match) {
      let y = parseInt(match[1], 10);
      let q = parseInt(match[2], 10);
      q += 1;
      if (q > 4) { q = 1; y += 1; }
      return `${y}-Q${q}`;
    }
  }

  // YYYY-W01
  if (gran.includes('week') || /^\d{4}-W\d{2}$/i.test(str)) {
    const match = str.match(/^(\d{4})-W(\d{2})$/i);
    if (match) {
      let y = parseInt(match[1], 10);
      let w = parseInt(match[2], 10);
      w += 1;
      if (w > 52) { w = 1; y += 1; }
      return `${y}-W${String(w).padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD
  if (gran.includes('day') || /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  return `${dateKey} (+1)`;
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

      if (features.length < 1) {
        return {
          status: 'cannot_answer',
          operation: 'anomaly_detection',
          reason: 'At least one eligible numerical measure is required for anomaly detection.',
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored: 0 }
        };
      }

      // Phase 7 IQR statistical outlier detection
      const featureDistributions = {};
      features.forEach(f => {
        const { numbers } = extractNumericArray(filteredRows, f);
        if (numbers.length > 0) {
          const sorted = [...numbers].sort((a, b) => a - b);
          const count = sorted.length;
          const getPercentile = (arr, p) => {
            const idx = (arr.length - 1) * p;
            const lower = Math.floor(idx);
            const upper = Math.ceil(idx);
            return arr[lower] * (1 - (idx - lower)) + arr[upper] * (idx - lower);
          };
          const q1 = getPercentile(sorted, 0.25);
          const q3 = getPercentile(sorted, 0.75);
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          const mid = Math.floor(count / 2);
          const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          featureDistributions[f] = { numbers, sorted, median, q1, q3, iqr, lowerBound, upperBound };
        }
      });

      // Extract complete case rows
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

      if (validRows.length < 1) {
        return {
          status: 'cannot_answer',
          operation: 'anomaly_detection',
          reason: 'Insufficient valid observations to run IQR statistical anomaly detection.',
          result: [],
          metadata: { rowsAnalyzed: validRows.length, rowsExcluded }
        };
      }

      let anomalyCount = 0;
      let normalCount = 0;

      const scoredRows = validRows.map((row, i) => {
        let maxDistance = 0;
        const contextParts = [];

        features.forEach((f, fIdx) => {
          const val = featureMatrix[i][fIdx];
          const distObj = featureDistributions[f];
          if (distObj) {
            const { lowerBound, upperBound, iqr } = distObj;
            const step = iqr > 0 ? iqr : 1;

            if (val > upperBound) {
              const dev = (val - upperBound) / step;
              if (dev > maxDistance) maxDistance = dev;
              contextParts.push(`${f} (${val}) is above IQR upper bound (${Number(upperBound.toFixed(2))})`);
            } else if (val < lowerBound) {
              const dev = (lowerBound - val) / step;
              if (dev > maxDistance) maxDistance = dev;
              contextParts.push(`${f} (${val}) is below IQR lower bound (${Number(lowerBound.toFixed(2))})`);
            }
          }
        });

        const isOutlier = maxDistance > 0;
        if (isOutlier) anomalyCount++; else normalCount++;

        const contextStr = contextParts.length > 0 
          ? contextParts.join('; ')
          : `All feature values within 1.5x IQR statistical bounds`;

        const idCol = Object.keys(row).find(k => k.toLowerCase().includes('id') || k.toLowerCase() === '#') || 'Order_ID';
        const rawId = getCellValue(row, idCol);

        const resultObj = {
          [idCol]: rawId !== undefined ? rawId : i + 1,
          'Outlier Status': isOutlier ? 'Statistical Outlier' : 'Within Bounds'
        };

        features.forEach((f, fIdx) => {
          resultObj[f] = featureMatrix[i][fIdx];
        });

        resultObj['Supporting Context'] = contextStr;

        return { ...resultObj, maxDistance };
      });

      // Sort by max distance outside IQR bounds descending
      scoredRows.sort((a, b) => b.maxDistance - a.maxDistance);

      const finalResultData = scoredRows.map(({ maxDistance, ...rest }) => rest);
      resultData = finalResultData;

      const featureX = features[0];
      const featureY = features.length > 1 ? features[1] : features[0];

      const scatterPoints = validRows.map((row, i) => {
        const idCol = Object.keys(row).find(k => k.toLowerCase().includes('id') || k.toLowerCase() === '#') || 'Order_ID';
        const rawId = getCellValue(row, idCol);
        const itemObj = scoredRows.find(sr => String(sr[idCol]) === String(rawId !== undefined ? rawId : i + 1));
        return {
          x: featureMatrix[i][0],
          y: featureMatrix[i][features.length > 1 ? 1 : 0],
          id: rawId !== undefined ? rawId : i + 1,
          status: itemObj ? itemObj['Outlier Status'] : 'Within Bounds'
        };
      });

      return {
        status: 'success',
        operation: 'anomaly_detection',
        columnsUsed: features,
        result: resultData,
        metadata: {
          operation: 'anomaly_detection',
          method: 'IQR Statistical Outlier Detection',
          iqrMultiplier: 1.5,
          features,
          totalRecords: rows.length,
          rowsAnalyzed: validRows.length,
          rowsExcluded,
          anomaliesDetected: anomalyCount,
          normalRecords: normalCount,
          anomalyRate: Number(((anomalyCount / validRows.length) * 100).toFixed(2)),
          scatterPoints,
          featureX,
          featureY
        }
      };
    }

    case 'forecast': {
      const targetCol = plan.target || plan.measure || plan.column;
      let dateCol = plan.date_column || plan.dateColumn;
      const agg = (plan.aggregation || 'sum').toLowerCase().trim();
      const granularity = (plan.granularity || 'month').toLowerCase().trim();
      const horizon = Math.max(1, parseInt(plan.horizon || 3, 10));

      if (!targetCol) {
        return {
          status: 'cannot_answer',
          operation: 'forecast',
          reason: 'Forecasting requires a numerical target column.',
          result: [],
          metadata: { rowsAnalyzed }
        };
      }

      if (!dateCol && filteredRows.length > 0) {
        const sampleRow = filteredRows[0];
        const keys = Object.keys(sampleRow);
        const dKey = keys.find(k => ['date', 'time', 'month', 'year', 'day', 'timestamp', 'created_at', 'order_date'].some(w => k.toLowerCase().includes(w)));
        if (dKey) dateCol = dKey;
      }

      if (!dateCol) {
        return {
          status: 'cannot_answer',
          operation: 'forecast',
          reason: 'Forecasting requires a valid date/time column.',
          result: [],
          metadata: { rowsAnalyzed }
        };
      }

      let invalidDatesCount = 0;
      let missingTargetCount = 0;
      const groupedDataMap = new Map();

      filteredRows.forEach(row => {
        const rawDate = getCellValue(row, dateCol);
        const parsedDate = parseDateValue(rawDate);
        if (!parsedDate) {
          invalidDatesCount++;
          return;
        }

        const rawTarget = getCellValue(row, targetCol);
        if (isMissingValue(rawTarget)) {
          missingTargetCount++;
          return;
        }

        const numTarget = parseNumber(rawTarget);
        if (isNaN(numTarget)) {
          missingTargetCount++;
          return;
        }

        const dateKey = getTimeGroupKey(parsedDate, granularity);
        if (!groupedDataMap.has(dateKey)) {
          groupedDataMap.set(dateKey, []);
        }
        groupedDataMap.get(dateKey).push(numTarget);
      });

      const aggregatedPeriods = [];
      groupedDataMap.forEach((vals, dKey) => {
        let aggVal = 0;
        if (agg === 'average' || agg === 'avg') {
          aggVal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        } else if (agg === 'count') {
          aggVal = vals.length;
        } else if (agg === 'max') {
          aggVal = Math.max(...vals);
        } else if (agg === 'min') {
          aggVal = Math.min(...vals);
        } else {
          aggVal = vals.reduce((a, b) => a + b, 0);
        }
        aggregatedPeriods.push({ dateKey: dKey, value: Number(aggVal.toFixed(4)) });
      });

      aggregatedPeriods.sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));

      const N = aggregatedPeriods.length;
      if (N < 2) {
        return {
          status: 'cannot_answer',
          operation: 'forecast',
          reason: 'Forecasting requires at least two historical time periods.',
          result: [],
          metadata: { rowsAnalyzed: N, invalidDatesExcluded: invalidDatesCount, missingTargetExcluded: missingTargetCount }
        };
      }

      const xVals = Array.from({ length: N }, (_, i) => i + 1);
      const yVals = aggregatedPeriods.map(p => p.value);

      const meanX = (N + 1) / 2;
      const meanY = yVals.reduce((a, b) => a + b, 0) / N;

      let ssXX = 0;
      let ssXY = 0;
      for (let i = 0; i < N; i++) {
        const dx = xVals[i] - meanX;
        const dy = yVals[i] - meanY;
        ssXX += dx * dx;
        ssXY += dx * dy;
      }

      const slope = ssXX > 0 ? ssXY / ssXX : 0;
      const intercept = meanY - slope * meanX;

      let sumResidualsSq = 0;
      for (let i = 0; i < N; i++) {
        const yHat = slope * xVals[i] + intercept;
        sumResidualsSq += Math.pow(yVals[i] - yHat, 2);
      }

      const rse = N > 2 ? Math.sqrt(sumResidualsSq / (N - 2)) : 0;
      const tCrit = 1.96;

      let backtestMetrics = null;
      if (N >= 4) {
        const K = Math.max(1, Math.min(3, Math.floor(N * 0.25)));
        const nTrain = N - K;
        const trainX = Array.from({ length: nTrain }, (_, i) => i + 1);
        const trainY = yVals.slice(0, nTrain);

        const mXTrain = (nTrain + 1) / 2;
        const mYTrain = trainY.reduce((a, b) => a + b, 0) / nTrain;

        let ssXXTr = 0;
        let ssXYTr = 0;
        for (let i = 0; i < nTrain; i++) {
          const dx = trainX[i] - mXTrain;
          const dy = trainY[i] - mYTrain;
          ssXXTr += dx * dx;
          ssXYTr += dx * dy;
        }

        const slopeTr = ssXXTr > 0 ? ssXYTr / ssXXTr : 0;
        const interceptTr = mYTrain - slopeTr * mXTrain;

        let absErrSum = 0;
        let sqErrSum = 0;
        let mapeErrSum = 0;
        let validMapeCount = 0;

        for (let j = 0; j < K; j++) {
          const tVal = nTrain + 1 + j;
          const actual = yVals[nTrain + j];
          const pred = slopeTr * tVal + interceptTr;
          const absErr = Math.abs(actual - pred);

          absErrSum += absErr;
          sqErrSum += absErr * absErr;

          if (actual !== 0) {
            mapeErrSum += (absErr / Math.abs(actual)) * 100;
            validMapeCount++;
          }
        }

        const zeroActualsExcluded = K - validMapeCount;
        const mae = Number((absErrSum / K).toFixed(2));
        const rmse = Number((Math.sqrt(sqErrSum / K)).toFixed(2));
        const mape = validMapeCount > 0 ? Number((mapeErrSum / validMapeCount).toFixed(2)) : null;

        backtestMetrics = {
          mae,
          rmse,
          mape,
          validationPeriods: K,
          trainingPeriods: nTrain,
          validMapeCount,
          zeroActualsExcluded
        };
      }

      const combinedResults = [];

      aggregatedPeriods.forEach(p => {
        combinedResults.push({
          Period: p.dateKey,
          Type: 'Historical',
          [targetCol]: p.value,
          'Lower Bound (95%)': '—',
          'Upper Bound (95%)': '—'
        });
      });

      let lastDateKey = aggregatedPeriods[N - 1].dateKey;
      const forecastSeries = [];

      for (let k = 1; k <= horizon; k++) {
        const nextTimeIndex = N + k;
        const rawForecast = slope * nextTimeIndex + intercept;
        const boundedForecast = Math.max(0, Number(rawForecast.toFixed(2)));

        const sePred = ssXX > 0 ? rse * Math.sqrt(1 + 1 / N + Math.pow(nextTimeIndex - meanX, 2) / ssXX) : 0;
        const marginOfError = tCrit * sePred;

        const lowerBound = Math.max(0, Number((boundedForecast - marginOfError).toFixed(2)));
        const upperBound = Number((boundedForecast + marginOfError).toFixed(2));

        const nextDateKey = incrementDateKey(lastDateKey, granularity);
        lastDateKey = nextDateKey;

        const forecastRow = {
          Period: nextDateKey,
          Type: 'Forecast',
          [targetCol]: boundedForecast,
          'Lower Bound (95%)': lowerBound,
          'Upper Bound (95%)': upperBound
        };

        combinedResults.push(forecastRow);
        forecastSeries.push({
          period: nextDateKey,
          forecast: boundedForecast,
          lowerBound,
          upperBound
        });
      }

      const latestHistoricalValue = yVals[N - 1];
      const latestHistoricalPeriod = aggregatedPeriods[N - 1].dateKey;
      const finalForecastValue = forecastSeries[horizon - 1].forecast;
      const finalForecastPeriod = forecastSeries[horizon - 1].period;
      const firstForecastValue = forecastSeries[0].forecast;
      const firstForecastPeriod = forecastSeries[0].period;

      const overallChangePercent = latestHistoricalValue > 0
        ? Number((((finalForecastValue - latestHistoricalValue) / latestHistoricalValue) * 100).toFixed(2))
        : 0;

      resultData = combinedResults;

      return {
        status: 'success',
        operation: 'forecast',
        columnsUsed: [dateCol, targetCol],
        result: resultData,
        metadata: {
          operation: 'forecast',
          target: targetCol,
          targetColumn: targetCol,
          dateColumn: dateCol,
          granularity,
          horizon,
          method: 'Linear Regression',
          confidenceLevel: 0.95,
          totalRecords: rows.length,
          rowsAnalyzed: N,
          historicalPeriods: N,
          invalidDatesExcluded: invalidDatesCount,
          missingTargetExcluded: missingTargetCount,
          latestHistoricalPeriod,
          latestHistoricalValue,
          firstForecastPeriod,
          firstForecastValue,
          finalForecastPeriod,
          finalForecastValue,
          overallChangePercent,
          slope: Number(slope.toFixed(4)),
          intercept: Number(intercept.toFixed(4)),
          backtestMetrics,
          forecastSeries
        }
      };
    }

    case 'insight_analysis': {
      const targetCol = plan.target_measure || plan.targetMeasure || plan.measure || plan.target || plan.column;
      let dateCol = plan.date_column || plan.dateColumn;
      let targetPeriod = plan.target_period || plan.targetPeriod;
      let comparisonPeriod = plan.comparison_period || plan.comparisonPeriod;
      let dims = Array.isArray(plan.dimensions) ? plan.dimensions : (plan.dimensions ? [plan.dimensions] : []);
      const focusCol = plan.focus_column || plan.focusColumn;
      const focusItem = plan.focus_item || plan.focusItem;

      if (!targetCol) {
        return {
          status: 'cannot_answer',
          operation: 'insight_analysis',
          reason: 'Automated insight analysis requires a numerical target measure column.',
          result: [],
          metadata: { rowsAnalyzed }
        };
      }

      // Auto-detect date column if missing
      if (!dateCol && filteredRows.length > 0) {
        const sampleRow = filteredRows[0];
        const keys = Object.keys(sampleRow);
        const dKey = keys.find(k => ['date', 'time', 'month', 'year', 'day', 'timestamp', 'created_at', 'order_date'].some(w => k.toLowerCase().includes(w)));
        if (dKey) dateCol = dKey;
      }

      // Auto-detect dimensions if missing
      if (dims.length === 0 && filteredRows.length > 0) {
        const sampleRow = filteredRows[0];
        const keys = Object.keys(sampleRow);
        dims = keys.filter(k => {
          const lower = k.toLowerCase().trim();
          if (lower.includes('id') || lower === dateCol?.toLowerCase()) return false;
          const val = getCellValue(sampleRow, k);
          return typeof val === 'string' || isNaN(parseNumber(val));
        });
      }

      // Extract valid observations by date / period
      let invalidDatesCount = 0;
      let missingTargetCount = 0;

      const rowsByPeriodMap = new Map();
      const allParsedRows = [];

      filteredRows.forEach(row => {
        const rawTarget = getCellValue(row, targetCol);
        if (isMissingValue(rawTarget)) {
          missingTargetCount++;
          return;
        }
        const numTarget = parseNumber(rawTarget);
        if (isNaN(numTarget)) {
          missingTargetCount++;
          return;
        }

        let pKey = '__ALL__';
        if (dateCol) {
          const rawDate = getCellValue(row, dateCol);
          const parsedDate = parseDateValue(rawDate);
          if (parsedDate) {
            pKey = getTimeGroupKey(parsedDate, 'MONTH');
          } else {
            invalidDatesCount++;
            return;
          }
        }

        if (!rowsByPeriodMap.has(pKey)) {
          rowsByPeriodMap.set(pKey, []);
        }
        const rowData = { ...row, _numTarget: numTarget, _pKey: pKey };
        rowsByPeriodMap.get(pKey).push(rowData);
        allParsedRows.push(rowData);
      });

      const sortedPeriods = Array.from(rowsByPeriodMap.keys()).sort((a, b) => String(a).localeCompare(String(b)));

      // Determine Target Period & Comparison Period
      let tPeriod = targetPeriod;
      let cPeriod = comparisonPeriod;

      if (sortedPeriods.length > 0 && sortedPeriods[0] !== '__ALL__') {
        if (!tPeriod || !rowsByPeriodMap.has(tPeriod)) {
          tPeriod = sortedPeriods[sortedPeriods.length - 1]; // Default to latest period
        }

        if (!cPeriod || !rowsByPeriodMap.has(cPeriod)) {
          const tIdx = sortedPeriods.indexOf(tPeriod);
          if (tIdx > 0) {
            cPeriod = sortedPeriods[tIdx - 1]; // Previous chronological period
          } else if (sortedPeriods.length > 1) {
            cPeriod = sortedPeriods[1];
          } else {
            cPeriod = tPeriod;
          }
        }
      } else {
        tPeriod = '__ALL__';
        cPeriod = '__ALL__';
      }

      const tRows = rowsByPeriodMap.get(tPeriod) || allParsedRows;
      const cRows = rowsByPeriodMap.get(cPeriod) || allParsedRows;

      const tVal = tRows.reduce((a, r) => a + r._numTarget, 0);
      const cVal = cRows.reduce((a, r) => a + r._numTarget, 0);

      const absChange = tVal - cVal;
      const overallChangePercent = cVal !== 0 ? Number((((tVal - cVal) / Math.abs(cVal)) * 100).toFixed(2)) : 0;
      const direction = absChange < 0 ? 'decrease' : (absChange > 0 ? 'increase' : 'stable');

      // Group-Wise Contribution Analysis across dimensions
      const dimensionBreakdowns = {};
      const combinedResultRows = [];
      const topContributorsList = [];

      dims.forEach(dim => {
        const tGroupSums = new Map();
        const cGroupSums = new Map();

        tRows.forEach(r => {
          const gVal = isMissingValue(getCellValue(r, dim)) ? 'Unknown' : String(getCellValue(r, dim)).trim();
          tGroupSums.set(gVal, (tGroupSums.get(gVal) || 0) + r._numTarget);
        });

        cRows.forEach(r => {
          const gVal = isMissingValue(getCellValue(r, dim)) ? 'Unknown' : String(getCellValue(r, dim)).trim();
          cGroupSums.set(gVal, (cGroupSums.get(gVal) || 0) + r._numTarget);
        });

        const allGroups = Array.from(new Set([...tGroupSums.keys(), ...cGroupSums.keys()]));
        const groupStats = allGroups.map(g => {
          const gTVal = tGroupSums.get(g) || 0;
          const gCVal = cGroupSums.get(g) || 0;
          const gAbsChange = gTVal - gCVal;
          const gPctChange = gCVal !== 0 ? Number((((gTVal - gCVal) / Math.abs(gCVal)) * 100).toFixed(2)) : 0;
          const contribPct = absChange !== 0 ? Number(((gAbsChange / absChange) * 100).toFixed(2)) : 0;

          return {
            Dimension: dim,
            Group: g,
            'Baseline Value': Number(gCVal.toFixed(2)),
            'Target Value': Number(gTVal.toFixed(2)),
            'Absolute Change': Number(gAbsChange.toFixed(2)),
            'Group Growth (%)': gPctChange,
            'Contribution to Total Change (%)': contribPct,
            rawAbsChange: gAbsChange
          };
        });

        // Sort groups by impact on change
        if (absChange < 0) {
          groupStats.sort((a, b) => a.rawAbsChange - b.rawAbsChange); // Most negative change first
        } else {
          groupStats.sort((a, b) => b.rawAbsChange - a.rawAbsChange); // Most positive change first
        }

        dimensionBreakdowns[dim] = groupStats;

        groupStats.forEach(gs => {
          const { rawAbsChange, ...cleanRow } = gs;
          combinedResultRows.push(cleanRow);
        });

        if (groupStats.length > 0) {
          const topImpact = groupStats[0];
          topContributorsList.push({
            dimension: dim,
            group: topImpact.Group,
            absoluteChange: topImpact['Absolute Change'],
            growthPercent: topImpact['Group Growth (%)'],
            contributionPercent: topImpact['Contribution to Total Change (%)']
          });
        }
      });

      // Supporting Correlation Evidence (Phase 10 integration)
      const sampleRow = filteredRows[0] || {};
      const numericCols = Object.keys(sampleRow).filter(k => {
        if (k === targetCol) return false;
        const lower = k.toLowerCase();
        if (lower.includes('id') || lower.includes('code')) return false;
        const val = getCellValue(sampleRow, k);
        return !isNaN(parseNumber(val));
      });

      const correlationEvidence = [];
      numericCols.forEach(otherCol => {
        const calc = computePairwiseCorrelation(filteredRows, targetCol, otherCol);
        if (calc.status === 'success' && Math.abs(calc.r) >= 0.1) {
          correlationEvidence.push({
            variable: otherCol,
            pearsonR: calc.rFormatted,
            rawR: calc.r,
            direction: calc.direction,
            strength: calc.strength,
            observations: calc.observations
          });
        }
      });
      correlationEvidence.sort((a, b) => Math.abs(b.rawR) - Math.abs(a.rawR));

      // Supporting Anomaly Evidence (Phase 11 IQR integration on target period)
      const tTargetNumbers = tRows.map(r => r._numTarget).sort((a, b) => a - b);
      let anomaliesInTargetPeriod = 0;
      let outlierContext = null;

      if (tTargetNumbers.length >= 4) {
        const count = tTargetNumbers.length;
        const getP = (arr, p) => arr[Math.floor((arr.length - 1) * p)];
        const q1 = getP(tTargetNumbers, 0.25);
        const q3 = getP(tTargetNumbers, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        tTargetNumbers.forEach(v => {
          if (v < lowerBound || v > upperBound) anomaliesInTargetPeriod++;
        });

        if (anomaliesInTargetPeriod > 0) {
          outlierContext = `${anomaliesInTargetPeriod} statistical outlier record(s) detected outside 1.5x IQR bounds (${Number(lowerBound.toFixed(2))} to ${Number(upperBound.toFixed(2))}) in ${tPeriod}.`;
        }
      }

      resultData = combinedResultRows;

      return {
        status: 'success',
        operation: 'insight_analysis',
        columnsUsed: [dateCol, targetCol, ...dims].filter(Boolean),
        result: resultData,
        metadata: {
          operation: 'insight_analysis',
          targetMeasure: targetCol,
          target: targetCol,
          dateColumn: dateCol,
          targetPeriod: tPeriod,
          comparisonPeriod: cPeriod,
          targetValue: Number(tVal.toFixed(2)),
          comparisonValue: Number(cVal.toFixed(2)),
          absoluteChange: Number(absChange.toFixed(2)),
          overallChangePercent,
          direction,
          focusColumn: focusCol,
          focusItem,
          dimensions: dims,
          topContributors: topContributorsList,
          dimensionBreakdowns,
          correlationEvidence,
          anomalyEvidence: {
            anomaliesDetected: anomaliesInTargetPeriod,
            outlierContext
          },
          totalRecords: rows.length,
          rowsAnalyzed: tRows.length + cRows.length
        }
      };
    }

    case 'executive_summary': {
      // 1. Column analysis and Schema profiling
      const totalRows = rows.length;
      const sampleRow = rows[0] || {};
      const allColNames = Object.keys(sampleRow);
      const totalCols = allColNames.length;

      const isIdCol = (name) => {
        const lower = String(name).toLowerCase().trim();
        return lower === 'id' || lower.endsWith('_id') || lower.startsWith('id_') || lower.includes('order_id') || lower.includes('customer_id') || lower.includes('user_id') || lower.includes('row_id') || lower.includes('index') || lower === '#';
      };

      const numericCols = [];
      const categoricalCols = [];
      const dateCols = [];

      allColNames.forEach(col => {
        if (isIdCol(col)) return;
        const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        if (vals.length === 0) return;

        const numCount = vals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
        const isNumeric = numCount / vals.length > 0.8;

        if (isNumeric) {
          numericCols.push(col);
        } else {
          const lower = col.toLowerCase();
          const isDate = ['date', 'time', 'month', 'year', 'day', 'timestamp', 'created_at', 'order_date'].some(k => lower.includes(k)) ||
            vals.slice(0, 10).every(v => !isNaN(Date.parse(v)));
          if (isDate) {
            dateCols.push(col);
          } else {
            categoricalCols.push(col);
          }
        }
      });

      // 2. Missing values & Duplicates
      let totalCells = totalRows * totalCols;
      let missingCells = 0;
      rows.forEach(r => {
        allColNames.forEach(col => {
          if (r[col] === null || r[col] === undefined || r[col] === '') {
            missingCells++;
          }
        });
      });
      const missingPercent = totalCells > 0 ? Number(((missingCells / totalCells) * 100).toFixed(2)) : 0;

      const seen = new Set();
      let duplicateRows = 0;
      rows.forEach(r => {
        const str = JSON.stringify(r);
        if (seen.has(str)) duplicateRows++;
        else seen.add(str);
      });

      // Quality Status
      let dataQualityStatus = 'CLEAN';
      let dataQualityMessage = 'Dataset is clean with zero missing values or duplicate records detected.';
      if (missingPercent > 20 || duplicateRows > totalRows * 0.1) {
        dataQualityStatus = 'CRITICAL';
        dataQualityMessage = `Critical data quality issues: ${missingCells} missing cell(s) (${missingPercent}%) and ${duplicateRows} duplicate row(s).`;
      } else if (missingPercent > 0 || duplicateRows > 0) {
        dataQualityStatus = 'WARNING';
        dataQualityMessage = `Data Quality Status: WARNING — ${missingCells} missing cell(s) (${missingPercent}%) and ${duplicateRows} duplicate row(s) detected.`;
      }

      // 3. Descriptive Stats & Outliers for Numeric Columns
      const stats = {};
      let totalIQRAnomalies = 0;
      numericCols.forEach(col => {
        const { numbers } = extractNumericArray(rows, col);
        if (numbers.length > 0) {
          const sorted = [...numbers].sort((a, b) => a - b);
          const count = sorted.length;
          const min = sorted[0];
          const max = sorted[count - 1];
          const sum = sorted.reduce((a, b) => a + b, 0);
          const mean = Number((sum / count).toFixed(4));
          const mid = Math.floor(count / 2);
          const median = count % 2 === 0 ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4)) : sorted[mid];

          const getP = (arr, p) => arr[Math.floor((arr.length - 1) * p)];
          const q1 = getP(sorted, 0.25);
          const q3 = getP(sorted, 0.75);
          const iqr = q3 - q1;
          const lowerB = q1 - 1.5 * iqr;
          const upperB = q3 + 1.5 * iqr;
          const outliers = sorted.filter(v => v < lowerB || v > upperB).length;
          totalIQRAnomalies += outliers;

          stats[col] = { count, min, max, mean, median, iqrOutliers: outliers };
        }
      });

      // 4. Correlations
      let correlationSummary = "Not available from the current analysis.";
      const topCorrelations = [];
      if (numericCols.length >= 2) {
        for (let i = 0; i < numericCols.length; i++) {
          for (let j = i + 1; j < numericCols.length; j++) {
            const colA = numericCols[i];
            const colB = numericCols[j];
            const validPairs = rows
              .map(r => ({ a: Number(r[colA]), b: Number(r[colB]) }))
              .filter(p => !isNaN(p.a) && !isNaN(p.b));

            if (validPairs.length >= 3) {
              const meanA = validPairs.reduce((s, p) => s + p.a, 0) / validPairs.length;
              const meanB = validPairs.reduce((s, p) => s + p.b, 0) / validPairs.length;
              let num = 0, denA = 0, denB = 0;
              validPairs.forEach(p => {
                const diffA = p.a - meanA;
                const diffB = p.b - meanB;
                num += diffA * diffB;
                denA += diffA * diffA;
                denB += diffB * diffB;
              });
              if (denA > 0 && denB > 0) {
                const r = num / (Math.sqrt(denA) * Math.sqrt(denB));
                topCorrelations.push({
                  pair: `${colA} & ${colB}`,
                  r: Number(r.toFixed(4)),
                  strength: Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : 'Weak'
                });
              }
            }
          }
        }
        if (topCorrelations.length > 0) {
          topCorrelations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
          const top = topCorrelations[0];
          correlationSummary = `Top correlation: ${top.pair} (r = ${top.r}, ${top.strength})`;
        }
      }

      // 5. Trend Analysis
      let trendSummary = "Not available from the current analysis.";
      if (dateCols.length > 0 && numericCols.length > 0) {
        const dateCol = dateCols[0];
        const numCol = numericCols.find(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue')) || numericCols[0];
        
        const monthlyGroups = new Map();
        rows.forEach(r => {
          const dVal = r[dateCol];
          if (dVal) {
            const k = getTimeGroupKey(dVal, 'MONTH');
            if (k) {
              const val = Number(r[numCol]);
              if (!isNaN(val)) {
                monthlyGroups.set(k, (monthlyGroups.get(k) || 0) + val);
              }
            }
          }
        });

        const sortedKeys = Array.from(monthlyGroups.keys()).sort();
        if (sortedKeys.length >= 2) {
          const points = sortedKeys.map(k => ({ y: monthlyGroups.get(k) }));
          const tr = calculateLinearTrend(points, 'MONTH');
          trendSummary = `${numCol} trend across ${sortedKeys.length} period(s): ${tr.trendDirection} (Slope: ${Number(tr.slope.toFixed(2))}, R²: ${Number(tr.r2.toFixed(4))})`;
        }
      }

      // 6. Forecasting Summary
      let forecastSummary = "Not available from the current analysis.";
      if (dateCols.length > 0 && numericCols.length > 0) {
        const dateCol = dateCols[0];
        const numCol = numericCols.find(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue')) || numericCols[0];
        
        const monthlyGroups = new Map();
        rows.forEach(r => {
          const dVal = r[dateCol];
          if (dVal) {
            const k = getTimeGroupKey(dVal, 'MONTH');
            if (k) {
              const val = Number(r[numCol]);
              if (!isNaN(val)) {
                monthlyGroups.set(k, (monthlyGroups.get(k) || 0) + val);
              }
            }
          }
        });

        const sortedKeys = Array.from(monthlyGroups.keys()).sort();
        if (sortedKeys.length >= 3) {
          const yValues = sortedKeys.map(k => monthlyGroups.get(k));
          const N = yValues.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          yValues.forEach((y, i) => {
            const x = i + 1;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
          });
          const slope = (N * sumXY - sumX * sumY) / (N * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / N;
          const nextVal = intercept + slope * (N + 1);
          forecastSummary = `Linear 1-period forecast for ${numCol}: ${Number(nextVal.toFixed(2))} (based on ${N} historical period(s))`;
        }
      }

      const summaryMetrics = [
        { Metric: 'Total Rows Analyzed', Value: totalRows },
        { Metric: 'Total Schema Columns', Value: totalCols },
        { Metric: 'Missing Values Count', Value: missingCells },
        { Metric: 'Missing Values (%)', Value: `${missingPercent}%` },
        { Metric: 'Duplicate Rows Count', Value: duplicateRows },
        { Metric: 'IQR Statistical Outliers', Value: totalIQRAnomalies },
        { Metric: 'Data Quality Status', Value: dataQualityStatus },
        { Metric: 'Trend Analysis', Value: trendSummary },
        { Metric: 'Top Correlation', Value: correlationSummary },
        { Metric: 'Forecast Summary', Value: forecastSummary }
      ];

      resultData = summaryMetrics;

      return {
        status: 'success',
        operation: 'executive_summary',
        columnsUsed: allColNames,
        result: resultData,
        metadata: {
          operation: 'executive_summary',
          totalRows,
          totalCols,
          missingCells,
          missingPercent,
          duplicateRows,
          dataQualityStatus,
          dataQualityMessage,
          numericColumnsCount: numericCols.length,
          categoricalColumnsCount: categoricalCols.length,
          dateColumnsCount: dateCols.length,
          stats,
          totalIQRAnomalies,
          topCorrelations,
          trendSummary,
          correlationSummary,
          forecastSummary,
          deterministicFindings: {
            datasetOverview: {
              rows: totalRows,
              columns: totalCols,
              numericColumns: numericCols,
              categoricalColumns: categoricalCols,
              dateColumns: dateCols
            },
            dataQuality: {
              status: dataQualityStatus,
              missingCells,
              missingPercent,
              duplicateRows,
              message: dataQualityMessage
            },
            majorStatisticalFindings: stats,
            importantTrends: trendSummary,
            importantCorrelations: correlationSummary,
            anomaliesOutliers: `${totalIQRAnomalies} IQR Statistical Outlier(s) detected`,
            forecastingInsight: forecastSummary
          },
          naturalLanguageExplanation: {
            summaryText: `The dataset contains ${totalRows} rows across ${totalCols} columns (${numericCols.length} numeric, ${categoricalCols.length} categorical, ${dateCols.length} date). Overall Data Quality is ${dataQualityStatus}. Total IQR Statistical Outliers: ${totalIQRAnomalies}.`,
            keyTakeaway: `Data ready for decision support analysis. Quality status: ${dataQualityStatus}.`
          }
        }
      };
    }

    case 'complete_report':
    case 'analysis_report': {
      // Complete Analysis Report executes dataset overview, quality, stats, correlations, trends, outliers, forecast & recommendations
      const totalRows = rows.length;
      const sampleRow = rows[0] || {};
      const allColNames = Object.keys(sampleRow);
      const totalCols = allColNames.length;

      const isIdCol = (name) => {
        const lower = String(name).toLowerCase().trim();
        return lower === 'id' || lower.endsWith('_id') || lower.startsWith('id_') || lower.includes('order_id') || lower.includes('customer_id') || lower.includes('user_id') || lower.includes('row_id') || lower.includes('index') || lower === '#';
      };

      const numericCols = [];
      const categoricalCols = [];
      const dateCols = [];

      allColNames.forEach(col => {
        if (isIdCol(col)) return;
        const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        if (vals.length === 0) return;
        const numCount = vals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
        if (numCount / vals.length > 0.8) numericCols.push(col);
        else {
          const lower = col.toLowerCase();
          const isDate = ['date', 'time', 'month', 'year', 'day', 'timestamp', 'created_at', 'order_date'].some(k => lower.includes(k)) || vals.slice(0, 10).every(v => !isNaN(Date.parse(v)));
          if (isDate) dateCols.push(col);
          else categoricalCols.push(col);
        }
      });

      let totalCells = totalRows * totalCols;
      let missingCells = 0;
      rows.forEach(r => {
        allColNames.forEach(col => {
          if (r[col] === null || r[col] === undefined || r[col] === '') missingCells++;
        });
      });
      const missingPercent = totalCells > 0 ? Number(((missingCells / totalCells) * 100).toFixed(2)) : 0;

      const seen = new Set();
      let duplicateRows = 0;
      rows.forEach(r => {
        const str = JSON.stringify(r);
        if (seen.has(str)) duplicateRows++;
        else seen.add(str);
      });

      let dataQualityStatus = missingPercent > 20 ? 'CRITICAL' : (missingPercent > 0 || duplicateRows > 0 ? 'WARNING' : 'CLEAN');
      let dataQualityMessage = dataQualityStatus === 'CLEAN'
        ? 'Dataset is clean with zero missing values or duplicate records detected.'
        : `Data Quality Status: ${dataQualityStatus} — ${missingCells} missing cell(s) (${missingPercent}%) and ${duplicateRows} duplicate row(s) detected.`;

      const stats = {};
      let totalIQRAnomalies = 0;
      numericCols.forEach(col => {
        const { numbers } = extractNumericArray(rows, col);
        if (numbers.length > 0) {
          const sorted = [...numbers].sort((a, b) => a - b);
          const count = sorted.length;
          const min = sorted[0];
          const max = sorted[count - 1];
          const sum = sorted.reduce((a, b) => a + b, 0);
          const mean = Number((sum / count).toFixed(4));
          const mid = Math.floor(count / 2);
          const median = count % 2 === 0 ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4)) : sorted[mid];
          const getP = (arr, p) => arr[Math.floor((arr.length - 1) * p)];
          const q1 = getP(sorted, 0.25);
          const q3 = getP(sorted, 0.75);
          const iqr = q3 - q1;
          const lowerB = q1 - 1.5 * iqr;
          const upperB = q3 + 1.5 * iqr;
          const outliers = sorted.filter(v => v < lowerB || v > upperB).length;
          totalIQRAnomalies += outliers;
          stats[col] = { count, min, max, mean, median, iqrOutliers: outliers };
        }
      });

      let correlationSummary = "Not available from the current analysis.";
      const topCorrelations = [];
      if (numericCols.length >= 2) {
        for (let i = 0; i < numericCols.length; i++) {
          for (let j = i + 1; j < numericCols.length; j++) {
            const colA = numericCols[i];
            const colB = numericCols[j];
            const validPairs = rows.map(r => ({ a: Number(r[colA]), b: Number(r[colB]) })).filter(p => !isNaN(p.a) && !isNaN(p.b));
            if (validPairs.length >= 3) {
              const meanA = validPairs.reduce((s, p) => s + p.a, 0) / validPairs.length;
              const meanB = validPairs.reduce((s, p) => s + p.b, 0) / validPairs.length;
              let num = 0, denA = 0, denB = 0;
              validPairs.forEach(p => {
                const diffA = p.a - meanA, diffB = p.b - meanB;
                num += diffA * diffB; denA += diffA * diffA; denB += diffB * diffB;
              });
              if (denA > 0 && denB > 0) {
                const r = num / (Math.sqrt(denA) * Math.sqrt(denB));
                topCorrelations.push({ pair: `${colA} & ${colB}`, r: Number(r.toFixed(4)), strength: Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : 'Weak' });
              }
            }
          }
        }
        if (topCorrelations.length > 0) {
          topCorrelations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
          const top = topCorrelations[0];
          correlationSummary = `Top correlation: ${top.pair} (r = ${top.r}, ${top.strength})`;
        }
      }

      let trendSummary = "Not available from the current analysis.";
      if (dateCols.length > 0 && numericCols.length > 0) {
        const dateCol = dateCols[0];
        const numCol = numericCols.find(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue')) || numericCols[0];
        const monthlyGroups = new Map();
        rows.forEach(r => {
          const dVal = r[dateCol];
          if (dVal) {
            const k = getTimeGroupKey(dVal, 'MONTH');
            if (k) {
              const val = Number(r[numCol]);
              if (!isNaN(val)) monthlyGroups.set(k, (monthlyGroups.get(k) || 0) + val);
            }
          }
        });
        const sortedKeys = Array.from(monthlyGroups.keys()).sort();
        if (sortedKeys.length >= 2) {
          const points = sortedKeys.map(k => ({ y: monthlyGroups.get(k) }));
          const tr = calculateLinearTrend(points, 'MONTH');
          trendSummary = `${numCol} trend across ${sortedKeys.length} period(s): ${tr.trendDirection} (Slope: ${Number(tr.slope.toFixed(2))}, R²: ${Number(tr.r2.toFixed(4))})`;
        }
      }

      let forecastSummary = "Not available from the current analysis.";
      if (dateCols.length > 0 && numericCols.length > 0) {
        const dateCol = dateCols[0];
        const numCol = numericCols.find(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue')) || numericCols[0];
        const monthlyGroups = new Map();
        rows.forEach(r => {
          const dVal = r[dateCol];
          if (dVal) {
            const k = getTimeGroupKey(dVal, 'MONTH');
            if (k) {
              const val = Number(r[numCol]);
              if (!isNaN(val)) monthlyGroups.set(k, (monthlyGroups.get(k) || 0) + val);
            }
          }
        });
        const sortedKeys = Array.from(monthlyGroups.keys()).sort();
        if (sortedKeys.length >= 3) {
          const yValues = sortedKeys.map(k => monthlyGroups.get(k));
          const N = yValues.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          yValues.forEach((y, i) => { const x = i + 1; sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
          const slope = (N * sumXY - sumX * sumY) / (N * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / N;
          const nextVal = intercept + slope * (N + 1);
          forecastSummary = `Linear 1-period forecast for ${numCol}: ${Number(nextVal.toFixed(2))} (based on ${N} historical period(s))`;
        }
      }

      resultData = [
        { Section: '1. Dataset Overview', Value: `${totalRows} rows, ${totalCols} columns (${numericCols.length} numeric, ${categoricalCols.length} categorical, ${dateCols.length} date)` },
        { Section: '2. Data Quality Status', Value: `${dataQualityStatus} (${missingCells} missing cells, ${duplicateRows} duplicate rows)` },
        { Section: '3. Outliers & Anomalies', Value: `${totalIQRAnomalies} IQR Statistical Outliers detected` },
        { Section: '4. Trend Analysis', Value: trendSummary },
        { Section: '5. Correlation Analysis', Value: correlationSummary },
        { Section: '6. Forecasting Projection', Value: forecastSummary }
      ];

      return {
        status: 'success',
        operation: 'complete_report',
        columnsUsed: allColNames,
        result: resultData,
        metadata: {
          operation: 'complete_report',
          totalRows,
          totalCols,
          missingCells,
          missingPercent,
          duplicateRows,
          dataQualityStatus,
          dataQualityMessage,
          stats,
          totalIQRAnomalies,
          topCorrelations,
          trendSummary,
          correlationSummary,
          forecastSummary,
          traceability: {
            calculatedEvidence: 'Phases 1-14 Execution Engine Output',
            aiExplanations: 'Grounded Natural Language Summary & Recommendations'
          }
        }
      };
    }

    case 'regional_analysis': {
      const groupCol = plan.groupBy || plan.group_by || 'Region';
      const measureCol = plan.measure || plan.target || 'Sales';
      const dateCol = plan.date_column || plan.dateColumn || null;

      const groups = new Map();
      let totalMeasureSum = 0;

      rows.forEach(r => {
        const gKey = r[groupCol] !== undefined && r[groupCol] !== null ? String(r[groupCol]) : 'Unknown';
        const val = Number(r[measureCol]);
        if (!isNaN(val)) {
          totalMeasureSum += val;
          if (!groups.has(gKey)) {
            groups.set(gKey, { count: 0, sum: 0, values: [], dates: [] });
          }
          const gObj = groups.get(gKey);
          gObj.count++;
          gObj.sum += val;
          gObj.values.push(val);
          if (dateCol && r[dateCol]) gObj.dates.push({ date: r[dateCol], val });
        }
      });

      const regionalBreakdown = [];
      groups.forEach((gObj, gName) => {
        const mean = gObj.count > 0 ? gObj.sum / gObj.count : 0;
        const sharePct = totalMeasureSum > 0 ? Number(((gObj.sum / totalMeasureSum) * 100).toFixed(2)) : 0;
        
        let recentDropPct = 0;
        if (dateCol && gObj.dates.length >= 2) {
          const sortedDates = [...gObj.dates].sort((a, b) => new Date(a.date) - new Date(b.date));
          const latestVal = sortedDates[sortedDates.length - 1].val;
          const prevVal = sortedDates[sortedDates.length - 2].val;
          if (prevVal > 0) {
            recentDropPct = Number((((latestVal - prevVal) / prevVal) * 100).toFixed(2));
          }
        }

        regionalBreakdown.push({
          Region: gName,
          TotalSales: Number(gObj.sum.toFixed(2)),
          MeanSales: Number(mean.toFixed(2)),
          OrderCount: gObj.count,
          SharePercent: sharePct,
          RecentChangePercent: recentDropPct
        });
      });

      regionalBreakdown.sort((a, b) => b.TotalSales - a.TotalSales);

      let focusRegionObj = regionalBreakdown.find(r => r.RecentChangePercent < -20) ||
        regionalBreakdown[regionalBreakdown.length - 1] ||
        regionalBreakdown[0];

      resultData = regionalBreakdown;

      return {
        status: 'success',
        operation: 'regional_analysis',
        columnsUsed: [groupCol, measureCol, dateCol].filter(Boolean),
        result: resultData,
        metadata: {
          operation: 'regional_analysis',
          groupBy: groupCol,
          measure: measureCol,
          totalSystemSales: Number(totalMeasureSum.toFixed(2)),
          focusRegion: focusRegionObj.Region,
          focusRegionSales: focusRegionObj.TotalSales,
          focusRegionShare: focusRegionObj.SharePercent,
          focusRegionChange: focusRegionObj.RecentChangePercent,
          regionalBreakdown,
          reasonForFocus: focusRegionObj.RecentChangePercent < 0 
            ? `${focusRegionObj.Region} region experienced an acute ${Math.abs(focusRegionObj.RecentChangePercent)}% contraction in the recent period, requiring immediate operational attention.`
            : `${focusRegionObj.Region} region represents the primary operational metric segment under evaluation (${focusRegionObj.SharePercent}% market share).`
        }
      };
    }

    case 'select': {
      const targetCol = plan.column || plan.measure || 'Order_ID';
      const limitVal = plan.limit || 50;
      const values = filteredRows.slice(0, limitVal).map(r => getCellValue(r, targetCol)).filter(v => v !== undefined && v !== null);
      resultData = values.map(val => ({ [targetCol]: val }));
      columnsUsed = [targetCol];
      return {
        status: 'success',
        operation: 'select',
        columnsUsed,
        result: resultData,
        metadata: {
          operation: 'select',
          column: targetCol,
          limit: limitVal,
          totalRetrieved: resultData.length,
          rowsAnalyzed
        }
      };
    }

    case 'schema_info': {
      const sampleRow = rows[0] || {};
      const colNames = Object.keys(sampleRow);
      const columnsInfo = colNames.map(col => {
        const val = sampleRow[col];
        let type = typeof val;
        if (type === 'number') type = Number.isInteger(val) ? 'integer' : 'float';
        const nameLower = col.toLowerCase();
        let semanticType = 'categorical';
        if (nameLower.includes('id') || nameLower === '#') semanticType = 'identifier';
        else if (type === 'integer' || type === 'float') semanticType = 'measure';
        else if (nameLower.includes('date') || nameLower.includes('time')) semanticType = 'datetime';
        return { name: col, type, semanticType };
      });
      resultData = columnsInfo;
      columnsUsed = columnsInfo.map(c => c.name);
      return {
        status: 'success',
        operation: 'schema_info',
        columnsUsed,
        result: resultData,
        metadata: {
          operation: 'schema_info',
          totalColumns: columnsInfo.length,
          columns: columnsInfo,
          rowsAnalyzed
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
