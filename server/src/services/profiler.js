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

function isIdentifierColumn(colName, inferredType, uniqueCount, validCount, sampleValues = []) {
  if (!colName) return false;
  const name = String(colName).trim().toLowerCase();

  // 1. Metric keywords & units: If column name contains explicit measure/metric indicators, it is NOT an identifier unless it specifically ends with _id/id.
  const metricKeywords = [
    'sales', 'amount', 'price', 'quantity', 'revenue', 'cost', 'rating', 'profit', 'discount', 'score',
    'total', 'val', 'value', 'age', 'temp', 'temperature', 'spo2', 'bpm', 'rate', 'heart_rate', 'bp',
    'pressure', 'height', 'weight', 'salary', 'income', 'percentage', 'percent', 'count', 'frequency',
    'ratio', 'depth', 'width', 'length', 'distance', 'speed', 'duration', 'time_spent', 'level', 'index_score'
  ];

  const hasUnitSuffix = /(?:_[fFcC]|_Percent|_percent|_BPM|_bpm|_mg|_kg|_cm|_mm|_m|_usd|_EUR|_GB|_MB|_KB|_GB)$/.test(colName);

  const isExplicitIdName = /^(.*[\_\-\s])?(id|identifier|code|key|sku|uuid|guid|seq|#)$/i.test(name) ||
    name === 'id' ||
    name.endsWith('_id') ||
    name.endsWith('-id') ||
    name.endsWith(' id') ||
    name.startsWith('id_') ||
    name.startsWith('id-') ||
    name.includes('order_id') ||
    name.includes('customer_id') ||
    name.includes('user_id') ||
    name.includes('patient_id') ||
    name.includes('product_id') ||
    name.includes('transaction_id') ||
    name.includes('account_id') ||
    name.includes('invoice_id') ||
    name.includes('employee_id') ||
    name.includes('student_id');

  // If column name has metric keywords / units and is NOT an explicit ID name, it's never an identifier
  if ((hasUnitSuffix || metricKeywords.some(k => name === k || name.startsWith(k + '_') || name.endsWith('_' + k) || name.includes('_' + k + '_') || name.includes(k))) && !isExplicitIdName) {
    return false;
  }

  // 2. Explicit Identifier Naming Patterns
  if (isExplicitIdName) {
    return true;
  }

  // 3. Non-numeric / String Value Patterns (e.g., "P001", "ORD-101", "CUST-999", "UUID-xxxx")
  if (sampleValues && sampleValues.length > 0) {
    const stringSamples = sampleValues.filter(v => typeof v === 'string' && v.trim() !== '');
    if (stringSamples.length > 0 && validCount > 0) {
      const alphaNumIdPattern = /^[A-Za-z]{1,4}[-_\s]?\d{1,10}$/;
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const isAlphaNumIds = stringSamples.every(v => alphaNumIdPattern.test(v.trim()) || uuidPattern.test(v.trim()));
      const uniqueRatio = uniqueCount / validCount;
      if (isAlphaNumIds && uniqueRatio >= 0.8) {
        return true;
      }
    }
  }

  // CRITICAL RULE: High uniqueness ratio alone on a numeric column (integer or float) NEVER qualifies as an identifier!
  return false;
}

function inferSemanticType(colName, inferredType, uniqueCount, validCount, sampleValues = []) {
  if (isIdentifierColumn(colName, inferredType, uniqueCount, validCount, sampleValues)) {
    return 'identifier';
  }
  if (inferredType === 'date' || inferredType === 'datetime') {
    return 'datetime';
  }
  if (inferredType === 'integer' || inferredType === 'float') {
    return 'measure';
  }
  return 'categorical';
}

function calculateNumericalIQR(numbers) {
  if (!numbers || numbers.length < 4) return null;
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
  const outliers = sorted.filter(v => v < lowerBound || v > upperBound);
  return {
    outlierCount: outliers.length,
    outlierPercentage: Number(((outliers.length / count) * 100).toFixed(2)),
    lowerBound: Number(lowerBound.toFixed(4)),
    upperBound: Number(upperBound.toFixed(4))
  };
}

function checkCategoricalConsistency(values) {
  const countsMap = new Map();
  const lowerMap = new Map();

  values.forEach(v => {
    const str = String(v).trim();
    if (str === '') return;
    countsMap.set(str, (countsMap.get(str) || 0) + 1);

    const lower = str.toLowerCase();
    if (!lowerMap.has(lower)) {
      lowerMap.set(lower, new Map());
    }
    lowerMap.get(lower).set(str, (lowerMap.get(lower).get(str) || 0) + 1);
  });

  const caseInconsistencies = [];
  lowerMap.forEach((variantsMap, lowerKey) => {
    if (variantsMap.size > 1) {
      const variants = Array.from(variantsMap.entries()).map(([val, cnt]) => `'${val}' (${cnt})`);
      caseInconsistencies.push({
        normalized: lowerKey,
        variants
      });
    }
  });

  return {
    uniqueCount: countsMap.size,
    hasCaseInconsistency: caseInconsistencies.length > 0,
    caseInconsistencies
  };
}

function checkInvalidValues(colName, validValues, validNumbers, semanticType, inferredType) {
  let invalidCount = 0;
  const invalidReasons = [];

  validNumbers.forEach(n => {
    if (!isFinite(n)) {
      invalidCount++;
      if (!invalidReasons.includes('Non-finite numerical value (NaN or Infinity)')) {
        invalidReasons.push('Non-finite numerical value (NaN or Infinity)');
      }
    }
  });

  const nameLower = String(colName).toLowerCase();
  const nonNegativeKeywords = ['price', 'sales', 'quantity', 'rating', 'amount', 'cost', 'revenue', 'age', 'discount', 'score', 'count', 'num', 'total', 'index'];
  const isLogicallyNonNegative = nonNegativeKeywords.some(k => nameLower.includes(k));

  if (isLogicallyNonNegative && semanticType === 'measure') {
    const negativeCount = validNumbers.filter(n => n < 0).length;
    if (negativeCount > 0) {
      invalidCount += negativeCount;
      invalidReasons.push(`${negativeCount} negative value(s) in non-negative metric column '${colName}'`);
    }
  }

  if (inferredType === 'date' || inferredType === 'datetime') {
    validValues.forEach(v => {
      if (typeof v === 'string') {
        const str = v.trim();
        const timestamp = Date.parse(str);
        if (isNaN(timestamp)) {
          invalidCount++;
          if (!invalidReasons.includes('Unparseable date string')) {
            invalidReasons.push('Unparseable date string');
          }
        } else {
          const year = new Date(timestamp).getFullYear();
          if (year < 1800 || year > 2100) {
            invalidCount++;
            if (!invalidReasons.includes(`Impossible date year (${year})`)) {
              invalidReasons.push(`Impossible date year (${year})`);
            }
          }
        }
      }
    });
  }

  return { invalidCount, invalidReasons };
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
    const semanticType = inferSemanticType(colName, type, uniqueCount, validValues.length, sampleValues);

    let statistics = null;
    let identifierStats = null;

    if (semanticType === 'identifier') {
      statistics = null;
      const duplicateCount = validValues.length - uniqueCount;
      const uniquenessPercentage = validValues.length > 0 ? Number(((uniqueCount / validValues.length) * 100).toFixed(2)) : 0;
      identifierStats = {
        storageType: type,
        semanticType: 'identifier',
        missingCount,
        missingPercentage: Number((missingPercentage * 100).toFixed(2)),
        uniqueCount,
        duplicateCount,
        uniquenessPercentage,
        isUnique: uniqueCount === validValues.length && validValues.length > 0
      };
    } else if (type === 'integer' || type === 'float') {
      statistics = calculateNumericalStats(validNumbers);
    }

    const categorical = (type === 'categorical' || type === 'text' || type === 'boolean')
      ? calculateCategoricalStats(validValues)
      : null;

    const catCheck = checkCategoricalConsistency(validValues);
    const invalidCheck = checkInvalidValues(colName, validValues, validNumbers, semanticType, type);

    let outlierCount = 0;
    let outlierDetails = null;
    if (semanticType === 'measure' && (type === 'integer' || type === 'float') && validNumbers.length >= 4) {
      const iqr = calculateNumericalIQR(validNumbers);
      if (iqr && iqr.outlierCount > 0) {
        outlierCount = iqr.outlierCount;
        outlierDetails = iqr;
      }
    }

    const colIssues = [];
    let colStatus = 'Clean';

    if (missingCount === rowCount) {
      colStatus = 'Critical';
      colIssues.push('Completely empty column (100% missing)');
    } else if (missingPercentage >= 0.50) {
      colStatus = 'Critical';
      colIssues.push(`Extremely high missing values (${(missingPercentage * 100).toFixed(1)}%)`);
    } else if (missingCount > 0) {
      if (colStatus !== 'Critical') colStatus = 'Warning';
      colIssues.push(`${missingCount} missing value(s) (${(missingPercentage * 100).toFixed(1)}%)`);
    }

    if (invalidCheck.invalidCount > 0) {
      colStatus = 'Critical';
      invalidCheck.invalidReasons.forEach(r => colIssues.push(`Invalid: ${r}`));
    }

    if (mixed) {
      if (colStatus !== 'Critical') colStatus = 'Warning';
      colIssues.push('Mixed data types detected (numeric & text)');
    }

    if (catCheck.hasCaseInconsistency) {
      if (colStatus !== 'Critical') colStatus = 'Warning';
      const sampleVar = catCheck.caseInconsistencies[0]?.variants?.slice(0, 2)?.join(', ') || '';
      colIssues.push(`Inconsistent capitalization detected (${sampleVar})`);
    }

    if (outlierCount > 0) {
      if (colStatus !== 'Critical') colStatus = 'Warning';
      colIssues.push(`${outlierCount} statistical IQR outlier(s) detected [${outlierDetails.lowerBound}, ${outlierDetails.upperBound}]`);
    }

    if (semanticType === 'identifier') {
      if (uniqueCount < validValues.length) {
        if (colStatus !== 'Critical') colStatus = 'Warning';
        colIssues.push(`${validValues.length - uniqueCount} duplicate ID(s) detected in identifier column`);
      } else {
        if (colIssues.length === 0) {
          colIssues.push('No statistical aggregation required (Identifier)');
        }
      }
    }

    if (colIssues.length === 0) {
      colIssues.push('Clean');
    }

    columnProfiles.push({
      name: colName,
      type,
      dataType: (type === 'integer' || type === 'float') ? (type === 'integer' ? 'integer' : 'numeric') : type,
      semanticType,
      missingCount,
      missingPercentage,
      uniqueCount,
      outlierCount,
      invalidCount: invalidCheck.invalidCount,
      invalidReasons: invalidCheck.invalidReasons,
      caseInconsistency: catCheck.hasCaseInconsistency ? catCheck.caseInconsistencies : null,
      sampleValues,
      statistics,
      categorical,
      identifierStats,
      status: colStatus,
      issues: colIssues
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

    if (invalidCheck.invalidCount > 0) {
      warnings.push({
        id: `warn_invalid_${colName}`,
        type: 'invalid_values',
        severity: 'critical',
        column: colName,
        message: `Column '${colName}' contains ${invalidCheck.invalidCount} invalid value(s).`
      });
    }

    if (catCheck.hasCaseInconsistency) {
      warnings.push({
        id: `warn_case_${colName}`,
        type: 'inconsistent_capitalization',
        severity: 'warning',
        column: colName,
        message: `Categorical column '${colName}' has inconsistent capitalization/spelling variations.`
      });
    }
  });

  const totalCells = rowCount * columnCount;
  let totalMissing = 0;
  let totalInvalid = 0;
  let totalOutliers = 0;
  let criticalColumnsCount = 0;
  let warningColumnsCount = 0;

  columnProfiles.forEach(c => {
    totalMissing += c.missingCount;
    totalInvalid += c.invalidCount || 0;
    totalOutliers += c.outlierCount || 0;
    if (c.status === 'Critical') criticalColumnsCount++;
    else if (c.status === 'Warning') warningColumnsCount++;
  });

  const missingCellPercentage = totalCells > 0 ? Number(((totalMissing / totalCells) * 100).toFixed(2)) : 0;
  const duplicateRowPercentage = Number((duplicates.percentage * 100).toFixed(2));

  let overallStatus = 'CLEAN';
  let statusMessage = 'No major data-quality issues detected. The dataset is suitable for analysis.';

  if (criticalColumnsCount > 0 || duplicateRowPercentage >= 50.0 || missingCellPercentage >= 25.0 || totalInvalid > 0) {
    overallStatus = 'CRITICAL';
    statusMessage = 'Critical data-quality issues detected. Analysis results may be unreliable until data is cleaned.';
  } else if (warningColumnsCount > 0 || duplicates.count > 0 || totalOutliers > 0 || totalMissing > 0) {
    overallStatus = 'WARNING';
    if (totalMissing > 0 && totalOutliers > 0) {
      statusMessage = 'Minor data-quality issues detected. The dataset contains some missing values and statistical outliers, but no critical structural or invalid-data issues were found. Analysis can proceed with appropriate handling.';
    } else if (totalOutliers > 0 && totalMissing === 0) {
      statusMessage = 'Minor statistical anomalies detected. The dataset contains some statistical outliers, but no structural or invalid-data issues were found. Analysis can proceed with appropriate handling.';
    } else {
      statusMessage = 'Minor data-quality issues detected. The dataset contains some minor warnings, but no critical structural or invalid-data issues were found. Analysis can proceed with appropriate handling.';
    }
  }

  const qualitySummary = {
    overallStatus,
    statusMessage,
    metrics: {
      rowCount,
      columnCount,
      totalCells,
      totalMissing,
      missingPercentage: missingCellPercentage,
      totalDuplicates: duplicates.count,
      duplicatePercentage: Number((duplicates.percentage * 100).toFixed(2)),
      totalInvalid,
      totalOutliers,
      cleanColumnsCount: columnCount - (criticalColumnsCount + warningColumnsCount),
      warningColumnsCount,
      criticalColumnsCount
    },
    columnSummaryTable: columnProfiles.map(c => ({
      name: c.name,
      type: c.type,
      dataType: c.dataType,
      semanticType: c.semanticType,
      missingCount: c.missingCount,
      missingPercentage: c.missingPercentage,
      uniqueCount: c.uniqueCount,
      outlierCount: c.outlierCount || 0,
      invalidCount: c.invalidCount || 0,
      status: c.status,
      issues: c.issues
    }))
  };

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
    warnings,
    qualitySummary
  };
}

module.exports = {
  profileDataset,
  isMissingValue,
  inferColumnType,
  isIdentifierColumn,
  inferSemanticType,
  calculateNumericalStats,
  calculateCategoricalStats,
  detectDuplicates,
  checkCategoricalConsistency,
  checkInvalidValues,
  calculateNumericalIQR
};
