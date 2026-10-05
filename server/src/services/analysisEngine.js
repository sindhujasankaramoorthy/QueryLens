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
