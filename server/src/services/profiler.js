/**
 * Profiler module for PSA01
 * Analyzes parsed dataset rows without modifying the original data.
 */

function isMissingValue(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return true;
    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === 'nan' || lower === 'n/a' || lower === 'none' || lower === 'nil') {
      return true;
    }
  }
  return false;
}

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return NaN;
    // Avoid parsing hex or empty spaces
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  return NaN;
}

function isDateValue(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { isDate: true, hasTime: val.getHours() !== 0 || val.getMinutes() !== 0 || val.getSeconds() !== 0, ambiguous: false };
  }
  if (typeof val !== 'string') return { isDate: false };
  const str = val.trim();
  if (!str || str.length < 5) return { isDate: false };

  // Don't treat raw numbers like "2025" or "100" as dates
  if (/^\d+$/.test(str)) return { isDate: false };

  // Ambiguous slash check like 01/02/2025
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let ambiguous = false;
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    if (p1 <= 12 && p2 <= 12 && p1 !== p2) {
      ambiguous = true;
    }
  }

  // Standard date regexes
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
  const commonDateRegex = /^(\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4})(\s+\d{1,2}:\d{2}(:\d{2})?)?$/;
  const monthNameRegex = /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/;
  const monthYearRegex = /^[A-Za-z]{3,9}\s+\d{4}$/;

  if (isoRegex.test(str) || commonDateRegex.test(str) || monthNameRegex.test(str) || monthYearRegex.test(str)) {
    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      const year = new Date(timestamp).getFullYear();
      if (year >= 1800 && year <= 2100) {
        const hasTime = str.includes(':') || str.includes('T');
        return { isDate: true, hasTime, ambiguous };
      }
    }
  }

  return { isDate: false };
}

function inferColumnType(values) {
  let intCount = 0;
  let floatCount = 0;
  let boolCount = 0;
  let dateCount = 0;
  let datetimeCount = 0;
  let ambiguousDateCount = 0;
  let textCount = 0;

  const totalValid = values.length;
  if (totalValid === 0) {
    return { type: 'text', mixed: false, dateAmbiguous: false };
  }

  values.forEach(val => {
    if (typeof val === 'boolean' || val === 'true' || val === 'false' || val === 'TRUE' || val === 'FALSE') {
      boolCount++;
      return;
    }

    const num = parseNumber(val);
    if (!isNaN(num)) {
      if (Number.isInteger(num)) {
        intCount++;
      } else {
        floatCount++;
      }
      return;
    }

    const dateCheck = isDateValue(val);
    if (dateCheck.isDate) {
      if (dateCheck.hasTime) {
        datetimeCount++;
      } else {
        dateCount++;
      }
      if (dateCheck.ambiguous) {
        ambiguousDateCount++;
      }
      return;
    }

    textCount++;
  });

  const numericCount = intCount + floatCount;
  const allDateCount = dateCount + datetimeCount;
  const isMixed = (numericCount > 0 && textCount > 0 && numericCount / totalValid > 0.05 && textCount / totalValid > 0.05);

  let inferredType = 'text';

  if (boolCount / totalValid >= 0.8) {
    inferredType = 'boolean';
  } else if (numericCount / totalValid >= 0.8) {
    inferredType = floatCount > 0 ? 'float' : 'integer';
  } else if (allDateCount / totalValid >= 0.8) {
    inferredType = datetimeCount > dateCount ? 'datetime' : 'date';
  } else {
    // Check if categorical
    const uniqueValues = new Set(values.map(v => String(v).trim()));
    if (uniqueValues.size <= 50 || (uniqueValues.size / totalValid <= 0.2 && totalValid >= 10)) {
      inferredType = 'categorical';
    } else {
      inferredType = 'text';
    }
  }

  return {
    type: inferredType,
    mixed: isMixed,
    dateAmbiguous: ambiguousDateCount > 0 && allDateCount / totalValid >= 0.5
  };
}

function calculateNumericalStats(numbers) {
  if (!numbers || numbers.length === 0) return null;

  const count = numbers.length;
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  const mean = sum / count;

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  let median;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  let std = 0;
  if (count > 1) {
    const variance = numbers.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / (count - 1);
    std = Math.sqrt(variance);
  }

  return {
    count,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    std: Number(std.toFixed(4))
  };
}

function calculateCategoricalStats(values, maxTop = 5) {
  const countsMap = new Map();
  values.forEach(v => {
    const key = String(v).trim();
    countsMap.set(key, (countsMap.get(key) || 0) + 1);
  });

  const total = values.length;
  const sortedEntries = Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1]);

  const topValues = sortedEntries.slice(0, maxTop).map(([val, count]) => ({
    value: val,
    count,
    frequency: Number((count / total).toFixed(4))
  }));

  return {
    uniqueCount: countsMap.size,
    topValues
  };
}

function detectDuplicates(rows, columns) {
  if (!rows || rows.length === 0) return { count: 0, percentage: 0 };

  const seen = new Set();
  let duplicateCount = 0;

  rows.forEach(row => {
    // Normalize row representation across columns
    const normalized = columns.map(col => {
      const val = row[col];
      return isMissingValue(val) ? '' : String(val).trim();
    }).join('||');

    if (seen.has(normalized)) {
      duplicateCount++;
    } else {
      seen.add(normalized);
    }
  });

  const percentage = Number((duplicateCount / rows.length).toFixed(4));
  return {
    count: duplicateCount,
    percentage
  };
}

function profileDataset(parsedData) {
  let fileName = 'dataset.csv';
  let fileSize = 0;
  let fileType = 'csv';
  let rows = [];
  let columns = [];

  if (Array.isArray(parsedData)) {
    rows = parsedData;
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else if (parsedData && typeof parsedData === 'object') {
    fileName = parsedData.fileName || 'dataset.csv';
    fileSize = parsedData.fileSize || 0;
    fileType = parsedData.fileType || 'csv';
    rows = Array.isArray(parsedData.rows) ? parsedData.rows : [];
    columns = Array.isArray(parsedData.columns) ? parsedData.columns : (rows.length > 0 ? Object.keys(rows[0]) : []);
  }

  const rowCount = rows.length;
  const columnCount = columns.length;

  const duplicates = detectDuplicates(rows, columns);
  const columnProfiles = [];
  const warnings = [];

  if (duplicates.count > 0) {
    warnings.push({
      id: 'warn_duplicates',
      type: 'duplicate_rows',
      severity: 'warning',
      column: null,
      message: `Detected ${duplicates.count} duplicate row(s) (${(duplicates.percentage * 100).toFixed(2)}% of dataset).`
    });
  }

  columns.forEach(colName => {
    let missingCount = 0;
    const validValues = [];
    const validNumbers = [];
    const sampleValues = [];

    rows.forEach(row => {
      const val = row[colName];
      if (isMissingValue(val)) {
        missingCount++;
      } else {
        validValues.push(val);
        const num = parseNumber(val);
        if (!isNaN(num)) {
          validNumbers.push(num);
        }
        if (sampleValues.length < 5) {
          sampleValues.push(val);
        }
      }
    });

    const missingPercentage = Number((missingCount / rowCount).toFixed(4));
    const uniqueValuesSet = new Set(validValues.map(v => String(v).trim()));
    const uniqueCount = uniqueValuesSet.size;

    const { type, mixed, dateAmbiguous } = inferColumnType(validValues);

    let statistics = null;
    if (type === 'integer' || type === 'float') {
      statistics = calculateNumericalStats(validNumbers);
    }

    const categorical = (type === 'categorical' || type === 'text' || type === 'boolean')
      ? calculateCategoricalStats(validValues)
      : null;

    columnProfiles.push({
      name: colName,
      type,
      missingCount,
      missingPercentage,
      uniqueCount,
      sampleValues,
      statistics,
      categorical
    });

    // Generate warnings per column
    if (missingPercentage >= 0.15) {
      warnings.push({
        id: `warn_missing_${colName}`,
        type: 'high_missing_values',
        severity: missingPercentage >= 0.5 ? 'critical' : 'warning',
        column: colName,
        message: `Column '${colName}' has ${(missingPercentage * 100).toFixed(1)}% missing values (${missingCount}/${rowCount} rows).`
      });
    }

    if (missingCount === rowCount) {
      warnings.push({
        id: `warn_empty_${colName}`,
        type: 'empty_column',
        severity: 'critical',
        column: colName,
        message: `Column '${colName}' is completely empty.`
      });
    } else if (uniqueCount === 1 && rowCount > 1) {
      warnings.push({
        id: `warn_constant_${colName}`,
        type: 'constant_column',
        severity: 'info',
        column: colName,
        message: `Column '${colName}' has a constant value across all rows.`
      });
    }

    if (type === 'categorical' && uniqueCount > 30) {
      warnings.push({
        id: `warn_cardinality_${colName}`,
        type: 'high_cardinality',
        severity: 'warning',
        column: colName,
        message: `Categorical column '${colName}' has high cardinality (${uniqueCount} unique categories).`
      });
    }

    if (mixed) {
      warnings.push({
        id: `warn_mixed_${colName}`,
        type: 'mixed_types',
        severity: 'warning',
        column: colName,
        message: `Column '${colName}' contains mixed numeric and text values.`
      });
    }

    if (dateAmbiguous) {
      warnings.push({
        id: `warn_date_ambiguity_${colName}`,
        type: 'date_ambiguity',
        severity: 'info',
        column: colName,
        message: `Column '${colName}' contains ambiguous date formats (e.g., DD/MM vs MM/DD).`
      });
    }
  });

  return {
    rowCount,
    columnCount,
    dataset: {
      fileName,
      fileSize,
      fileType,
      rowCount,
      columnCount
    },
    columns: columnProfiles,
    duplicates,
    warnings
  };
}

module.exports = {
  profileDataset,
  isMissingValue,
  inferColumnType,
  calculateNumericalStats,
  calculateCategoricalStats,
  detectDuplicates
};
