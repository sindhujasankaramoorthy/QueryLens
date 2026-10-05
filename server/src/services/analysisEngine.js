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

    case 'time_group': {
      const dateCol = plan.column || plan.groupBy;
      const measure = plan.measure;
      const timeUnit = plan.timeUnit || 'month';
      const agg = (plan.aggregation || 'sum').toLowerCase();

      if (!dateCol) throw new Error('Time grouping operation requires a date column.');

      const timeGroupsMap = new Map();

      filteredRows.forEach(row => {
        const rawDate = getCellValue(row, dateCol);
        const dateKey = getTimeGroupKey(rawDate, timeUnit);

        if (!timeGroupsMap.has(dateKey)) {
          timeGroupsMap.set(dateKey, []);
        }

        if (measure) {
          const mVal = getCellValue(row, measure);
          if (!isMissingValue(mVal)) {
            const num = parseNumber(mVal);
            if (!isNaN(num)) {
              timeGroupsMap.get(dateKey).push(num);
            } else {
              missingValuesIgnored++;
            }
          } else {
            missingValuesIgnored++;
          }
        } else {
          timeGroupsMap.get(dateKey).push(1);
        }
      });

      const measureLabel = measure ? `${measure}_${agg}` : 'count';
      const timeList = [];

      timeGroupsMap.forEach((values, dateKey) => {
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

        timeList.push({
          [dateCol]: dateKey,
          [measureLabel]: Number(aggValue.toFixed(4))
        });
      });

      // Sort chronologically by date key
      timeList.sort((a, b) => String(a[dateCol]).localeCompare(String(b[dateCol])));

      resultData = plan.limit ? timeList.slice(0, plan.limit) : timeList;
      break;
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
      let colX = null;
      let colY = null;
      if (Array.isArray(plan.measures) && plan.measures.length >= 2) {
        colX = plan.measures[0];
        colY = plan.measures[1];
      } else {
        colX = plan.column;
        colY = plan.measure;
      }

      if (!colX || !colY) {
        throw new Error('Correlation analysis requires two numeric column measures.');
      }

      const pairs = [];
      filteredRows.forEach(row => {
        const valX = getCellValue(row, colX);
        const valY = getCellValue(row, colY);

        if (isMissingValue(valX) || isMissingValue(valY)) {
          missingValuesIgnored++;
          return;
        }

        const numX = parseNumber(valX);
        const numY = parseNumber(valY);

        if (isNaN(numX) || isNaN(numY)) {
          missingValuesIgnored++;
          return;
        }

        pairs.push({ x: numX, y: numY });
      });

      const observations = pairs.length;
      if (observations < 2) {
        return {
          status: 'cannot_answer',
          operation: 'correlation',
          reason: observations === 0 
            ? `No valid paired observations exist between '${colX}' and '${colY}'.` 
            : `Insufficient paired observations (${observations}) to calculate correlation between '${colX}' and '${colY}'. At least 2 valid paired observations are required.`,
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored }
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
        const zeroVarCol = (sumVarX === 0 && sumVarY === 0) ? `'${colX}' and '${colY}'` : (sumVarX === 0 ? `'${colX}'` : `'${colY}'`);
        return {
          status: 'cannot_answer',
          operation: 'correlation',
          reason: `Correlation cannot be calculated because column ${zeroVarCol} has zero variance (constant values).`,
          result: [],
          metadata: { rowsAnalyzed, missingValuesIgnored }
        };
      }

      let r = sumCov / (Math.sqrt(sumVarX) * Math.sqrt(sumVarY));
      if (r > 1) r = 1;
      if (r < -1) r = -1;

      const rFormatted = Number(r.toFixed(4));

      resultData = [{
        columnX: colX,
        columnY: colY,
        correlation: rFormatted,
        observations: observations,
        method: 'pearson'
      }];

      if (!columnsUsed.includes(colX)) columnsUsed.push(colX);
      if (!columnsUsed.includes(colY)) columnsUsed.push(colY);

      return {
        status: 'success',
        operation,
        columnsUsed,
        result: resultData,
        metadata: {
          rowsAnalyzed,
          missingValuesIgnored,
          scatterPoints: pairs
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
