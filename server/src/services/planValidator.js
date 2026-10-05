/**
 * Strict Plan Validator Service for PSA01 (Phase 2)
 * Validates LLM-proposed analysis plans against actual dataset schema.
 * Rejects arbitrary code, non-existent columns, type mismatches, and unsupported operations.
 */

const SUPPORTED_OPERATIONS = new Set([
  'count',
  'sum',
  'average',
  'median',
  'min',
  'max',
  'group_aggregate',
  'sort',
  'filter',
  'top_n',
  'bottom_n',
  'time_group',
  'time_series',
  'describe',
  'correlation',
  'correlation_matrix',
  'anomaly_detection',
  'forecast',
  'insight_analysis'
]);

const SUPPORTED_AGGREGATIONS = new Set([
  'sum',
  'average',
  'median',
  'min',
  'max',
  'count'
]);

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bspawn\s*\(/i,
  /\bimport\s+[\w{\*]/i,
  /\brequire\s*\(/i,
  /\bprocess\./i,
  /\bwindow\./i,
  /\bdocument\./i,
  /<script/i,
  /\bselect\s+.*\s+from\b/i,
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bpython\b/i,
  /process\.exit/i
];

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[_.\-\/\\#,;:!?()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNumericType(type) {
  return type === 'integer' || type === 'float';
}

function isDateType(type, colName) {
  if (type === 'date' || type === 'datetime') return true;
  if (colName && typeof colName === 'string') {
    const lower = colName.toLowerCase();
    return ['date', 'time', 'month', 'year', 'day', 'timestamp', 'created_at', 'order_date'].some(k => lower.includes(k));
  }
  return false;
}

function checkForArbitraryCode(obj) {
  const str = JSON.stringify(obj);
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(str)) {
      return `Forbidden expression or arbitrary code detected matching pattern '${pattern.source}'.`;
    }
  }
  return null;
}

/**
 * Validates an analysis plan against dataset profile/schema.
 * @param {Object} rawPlan - Raw JSON object from LLM or client
 * @param {Array<Object>} schemaColumns - Array of column objects [{ name, type }, ...]
 * @returns {Object} { isValid: boolean, status: string, plan: Object|null, reason: string|null, clarificationQuestion: string|null }
 */
function validateAnalysisPlan(rawPlan, schemaColumns) {
  if (!rawPlan || typeof rawPlan !== 'object') {
    return {
      isValid: false,
      status: 'rejected',
      plan: null,
      reason: 'Invalid analysis plan: Response is not a valid JSON object.'
    };
  }

  // Check for dangerous code / SQL / shell attempt
  const codeThreat = checkForArbitraryCode(rawPlan);
  if (codeThreat) {
    return {
      isValid: false,
      status: 'rejected',
      plan: null,
      reason: codeThreat
    };
  }

  // Handle explicit cannot_answer response
  if (rawPlan.status === 'cannot_answer') {
    return {
      isValid: true,
      status: 'cannot_answer',
      plan: null,
      reason: rawPlan.reason || 'The question cannot be answered using the available dataset columns.'
    };
  }

  // Handle explicit clarification_required response
  if (rawPlan.status === 'clarification_required') {
    return {
      isValid: true,
      status: 'clarification_required',
      plan: null,
      clarificationQuestion: rawPlan.question || rawPlan.clarificationQuestion || 'Could you please clarify your question?'
    };
  }

  // Extract plan payload
  const plan = rawPlan.plan || rawPlan;
  const operation = (plan.operation || '').toLowerCase().trim();

  if (!operation || !SUPPORTED_OPERATIONS.has(operation)) {
    return {
      isValid: false,
      status: 'rejected',
      plan: null,
      reason: `Unsupported operation '${plan.operation}'. Supported operations: ${Array.from(SUPPORTED_OPERATIONS).join(', ')}.`
    };
  }

  // Build schema map for fast lookup & canonical column name resolution
  const schemaMap = new Map();
  const canonicalMap = new Map();
  const semanticMap = new Map();

  (schemaColumns || []).forEach(col => {
    let semType = col.semanticType;
    if (!semType) {
      const name = String(col.name).toLowerCase();
      if (name === 'id' || name.endsWith('_id') || name.startsWith('id_') || name.includes('identifier') || name.includes('code') || name === '#') {
        semType = 'identifier';
      } else if (col.type === 'date' || col.type === 'datetime') {
        semType = 'datetime';
      } else if (col.type === 'integer' || col.type === 'float') {
        semType = 'measure';
      } else {
        semType = 'categorical';
      }
    }

    schemaMap.set(col.name, col.type);
    schemaMap.set(col.name.toLowerCase(), col.type);
    semanticMap.set(col.name, semType);
    semanticMap.set(col.name.toLowerCase(), semType);

    const norm = normalizeText(col.name);
    if (norm) {
      schemaMap.set(norm, col.type);
      semanticMap.set(norm, semType);
    }

    canonicalMap.set(col.name, col.name);
    canonicalMap.set(col.name.toLowerCase(), col.name);
    if (norm) canonicalMap.set(norm, col.name);
  });

  const getColType = (name) => {
    if (!name) return null;
    return schemaMap.get(name) || schemaMap.get(name.toLowerCase()) || schemaMap.get(normalizeText(name)) || null;
  };

  const getColSemanticType = (name) => {
    if (!name) return null;
    return semanticMap.get(name) || semanticMap.get(name.toLowerCase()) || semanticMap.get(normalizeText(name)) || null;
  };

  const getCanonicalColName = (name) => {
    if (!name) return null;
    return canonicalMap.get(name) || canonicalMap.get(name.toLowerCase()) || canonicalMap.get(normalizeText(name)) || name;
  };

  // Helper to check column existence
  const checkColumn = (colName, role) => {
    if (!colName) return null;
    const type = getColType(colName);
    if (!type) {
      return `Column '${colName}' referenced in ${role} does not exist in the dataset schema.`;
    }
    return null;
  };

  // 1. Column existence checks
  if (plan.groupBy) {
    const err = checkColumn(plan.groupBy, 'groupBy');
    if (err) return { isValid: false, status: 'rejected', plan: null, reason: err };
  }

  if (plan.measure) {
    const err = checkColumn(plan.measure, 'measure');
    if (err) return { isValid: false, status: 'rejected', plan: null, reason: err };
  }

  if (plan.column) {
    const err = checkColumn(plan.column, 'column');
    if (err) return { isValid: false, status: 'rejected', plan: null, reason: err };
  }

  if (plan.filters && Array.isArray(plan.filters)) {
    for (const f of plan.filters) {
      if (f.column) {
        const err = checkColumn(f.column, 'filter');
        if (err) return { isValid: false, status: 'rejected', plan: null, reason: err };
      }
    }
  }

  // 2. Data Type & Semantic Compatibility Checks
  const targetMeasure = plan.measure || (plan.operation !== 'group_aggregate' ? plan.column : null);
  const agg = (plan.aggregation || '').toLowerCase().trim();

  if (agg && !SUPPORTED_AGGREGATIONS.has(agg)) {
    return {
      isValid: false,
      status: 'rejected',
      plan: null,
      reason: `Unsupported aggregation function '${plan.aggregation}'. Allowed aggregations: ${Array.from(SUPPORTED_AGGREGATIONS).join(', ')}.`
    };
  }

  // Identifier restrictions check: Identifier columns cannot be used as analytical measures for SUM, AVG, MIN, MAX, median, group aggregation, or correlation.
  if (targetMeasure && getColSemanticType(targetMeasure) === 'identifier') {
    const isCountAgg = agg === 'count' || operation === 'count';
    if (!isCountAgg) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Column '${getCanonicalColName(targetMeasure)}' is an identifier column, not an analytical numerical measure.`
      };
    }
  }

  // Numerical aggregations (sum, average, median, min, max) require numeric column
  if (targetMeasure && ['sum', 'average', 'median', 'min', 'max'].includes(agg || operation)) {
    const measureType = getColType(targetMeasure);
    if (!isNumericType(measureType)) {
      return {
        isValid: false,
        status: 'rejected',
        plan: null,
        reason: `Cannot calculate numerical aggregation '${agg || operation}' on non-numeric column '${targetMeasure}' (type: ${measureType}).`
      };
    }
  }

  // Time grouping / time series requires a valid date/datetime column and analytical measure
  if (operation === 'time_series' || operation === 'time_group' || plan.timeUnit || plan.granularity) {
    let dateCol = plan.date_column || plan.column || plan.groupBy;

    // Auto-detect date column from schema if not explicitly specified
    if (!dateCol) {
      const dateSchemaCol = (schemaColumns || []).find(c => isDateType(c.type, c.name));
      if (dateSchemaCol) dateCol = dateSchemaCol.name;
    }

    if (!dateCol) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Time-series analysis cannot be performed because the dataset does not contain a usable date/time column.'
      };
    }

    const colType = getColType(dateCol);
    if (!isDateType(colType, dateCol)) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Time-series analysis cannot be performed because the dataset does not contain a usable date/time column.'
      };
    }

    // Check target measure
    const targetMeas = plan.measure || (plan.column !== dateCol ? plan.column : null);
    if (targetMeas && getColSemanticType(targetMeas) === 'identifier') {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Column '${getCanonicalColName(targetMeas)}' is an identifier column, not an analytical numerical measure.`
      };
    }
  }

  // Correlation & Correlation Matrix Validation
  if (operation === 'correlation' || operation === 'correlation_matrix') {
    if (operation === 'correlation') {
      let rawMeasures = plan.measures;
      if (!Array.isArray(rawMeasures) || rawMeasures.length === 0) {
        if (plan.column_x && plan.column_y) {
          rawMeasures = [plan.column_x, plan.column_y];
        } else if (plan.column && plan.measure) {
          rawMeasures = [plan.column, plan.measure];
        }
      }

      if (!Array.isArray(rawMeasures) || rawMeasures.length < 2) {
        return {
          isValid: true,
          status: 'cannot_answer',
          plan: null,
          reason: 'Correlation analysis requires at least two numerical columns.'
        };
      }

      const canonicalMeasures = [];
      for (const m of rawMeasures.slice(0, 2)) {
        const type = getColType(m);
        if (!type) {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Column '${m}' does not exist in the dataset schema.`
          };
        }
        if (getColSemanticType(m) === 'identifier') {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Cannot calculate correlation. ${getCanonicalColName(m)} is classified as an identifier, not an analytical measure. Identifier columns are excluded from correlation analysis because their numerical values do not represent measurable quantities.`
          };
        }
        if (!isNumericType(type)) {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Correlation analysis requires numerical columns. Column '${m}' is of non-numeric type '${type}'.`
          };
        }
        canonicalMeasures.push(getCanonicalColName(m));
      }

      if (canonicalMeasures[0] === canonicalMeasures[1]) {
        return {
          isValid: true,
          status: 'cannot_answer',
          plan: null,
          reason: 'Correlation analysis requires two distinct numerical columns.'
        };
      }

      return {
        isValid: true,
        status: 'validated',
        plan: {
          operation: 'correlation',
          measures: canonicalMeasures,
          column_x: canonicalMeasures[0],
          column_y: canonicalMeasures[1],
          column: canonicalMeasures[0],
          measure: canonicalMeasures[1],
          method: 'pearson',
          filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
        },
        reason: null
      };
    }

    if (operation === 'correlation_matrix') {
      let rawCols = plan.columns || plan.measures;

      // Find all eligible numerical measure columns from schema
      const eligibleMeasureCols = (schemaColumns || [])
        .filter(c => isNumericType(c.type) && getColSemanticType(c.name) !== 'identifier')
        .map(c => c.name);

      if (Array.isArray(rawCols) && rawCols.length > 0) {
        for (const m of rawCols) {
          const type = getColType(m);
          if (!type) {
            return {
              isValid: true,
              status: 'cannot_answer',
              plan: null,
              reason: `Column '${m}' does not exist in the dataset schema.`
            };
          }
          if (getColSemanticType(m) === 'identifier') {
            return {
              isValid: true,
              status: 'cannot_answer',
              plan: null,
              reason: `Cannot calculate correlation. ${getCanonicalColName(m)} is classified as an identifier, not an analytical measure. Identifier columns are excluded from correlation analysis because their numerical values do not represent measurable quantities.`
            };
          }
          if (!isNumericType(type)) {
            return {
              isValid: true,
              status: 'cannot_answer',
              plan: null,
              reason: `Correlation analysis requires numerical columns. Column '${m}' is of non-numeric type '${type}'.`
            };
          }
        }
      } else {
        rawCols = eligibleMeasureCols;
      }

      const canonicalCols = Array.from(new Set(rawCols.map(m => getCanonicalColName(m))));

      if (canonicalCols.length < 2) {
        return {
          isValid: true,
          status: 'cannot_answer',
          plan: null,
          reason: 'Correlation analysis requires at least two numerical measure columns.'
        };
      }

      // Check target_column if specified
      let targetCol = plan.target_column || plan.targetColumn || null;
      if (targetCol) {
        if (getColSemanticType(targetCol) === 'identifier') {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Cannot calculate correlation. ${getCanonicalColName(targetCol)} is classified as an identifier, not an analytical measure. Identifier columns are excluded from correlation analysis because their numerical values do not represent measurable quantities.`
          };
        }
        targetCol = getCanonicalColName(targetCol);
      }

      return {
        isValid: true,
        status: 'validated',
        plan: {
          operation: 'correlation_matrix',
          columns: canonicalCols,
          measures: canonicalCols,
          target_column: targetCol,
          targetColumn: targetCol,
          method: 'pearson',
          filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
        },
        reason: null
      };
    }
  }

  if (operation === 'anomaly_detection') {
    let rawFeatures = plan.features || plan.columns || plan.measures;

    // Eligible numerical measure columns from schema
    const eligibleMeasureCols = (schemaColumns || [])
      .filter(c => isNumericType(c.type) && getColSemanticType(c.name) !== 'identifier')
      .map(c => c.name);

    if (eligibleMeasureCols.length === 0) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Anomaly detection cannot be performed because the dataset contains no eligible numerical measures.'
      };
    }

    let selectedFeatures = [];

    if (Array.isArray(rawFeatures) && rawFeatures.length > 0) {
      for (const f of rawFeatures) {
        const type = getColType(f);
        if (!type) {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Column '${f}' does not exist in the dataset schema.`
          };
        }

        if (getColSemanticType(f) === 'identifier') {
          const validMeasure = eligibleMeasureCols[0] || 'Sales';
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `${getCanonicalColName(f)} is an identifier and cannot be used as an anomaly-detection feature. ${validMeasure} can be used as a numerical measure.`
          };
        }

        if (!isNumericType(type)) {
          return {
            isValid: true,
            status: 'cannot_answer',
            plan: null,
            reason: `Anomaly detection requires numerical measure features. Column '${f}' is of non-numeric type '${type}'.`
          };
        }

        selectedFeatures.push(getCanonicalColName(f));
      }
    } else if (plan.feature || plan.column || plan.measure) {
      const singleF = plan.feature || plan.column || plan.measure;
      if (getColSemanticType(singleF) === 'identifier') {
        const validMeasure = eligibleMeasureCols[0] || 'Sales';
        return {
          isValid: true,
          status: 'cannot_answer',
          plan: null,
          reason: `${getCanonicalColName(singleF)} is an identifier and cannot be used as an anomaly-detection feature. ${validMeasure} can be used as a numerical measure.`
        };
      }
      selectedFeatures = [getCanonicalColName(singleF)];
    } else {
      selectedFeatures = eligibleMeasureCols;
    }

    selectedFeatures = Array.from(new Set(selectedFeatures));

    if (selectedFeatures.length < 1) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Anomaly detection requires at least one eligible numerical measure column.'
      };
    }

    return {
      isValid: true,
      status: 'validated',
      plan: {
        operation: 'anomaly_detection',
        method: 'iqr',
        features: selectedFeatures,
        columns: selectedFeatures,
        iqr_multiplier: 1.5,
        filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
      },
      reason: null
    };
  }

  if (operation === 'forecast') {
    const rawTarget = plan.target || plan.measure || plan.column;
    if (!rawTarget) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Forecasting requires a numerical target column.'
      };
    }

    const type = getColType(rawTarget);
    if (!type) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Column '${rawTarget}' does not exist in the dataset schema.`
      };
    }

    if (getColSemanticType(rawTarget) === 'identifier') {
      const validMeasure = (schemaColumns || []).find(c => isNumericType(c.type) && getColSemanticType(c.name) !== 'identifier');
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `${getCanonicalColName(rawTarget)} is an identifier column and cannot be used as a forecasting target. ${validMeasure ? validMeasure.name : 'Sales'} can be used as a numerical measure.`
      };
    }

    if (!isNumericType(type)) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Forecasting requires a numerical target measure. Column '${rawTarget}' is of non-numeric type '${type}'.`
      };
    }

    let rawDate = plan.date_column || plan.dateColumn;
    if (!rawDate) {
      const dateSchemaCol = (schemaColumns || []).find(c => isDateType(c.type, c.name));
      if (dateSchemaCol) rawDate = dateSchemaCol.name;
    }

    if (!rawDate) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Forecasting requires a valid date/time column.'
      };
    }

    const horizon = Math.max(1, parseInt(plan.horizon || 3, 10));
    const gran = String(plan.granularity || 'MONTH').toUpperCase();

    return {
      isValid: true,
      status: 'validated',
      plan: {
        operation: 'forecast',
        target: getCanonicalColName(rawTarget),
        measure: getCanonicalColName(rawTarget),
        column: getCanonicalColName(rawTarget),
        date_column: getCanonicalColName(rawDate),
        dateColumn: getCanonicalColName(rawDate),
        aggregation: (plan.aggregation || 'sum').toLowerCase(),
        granularity: gran,
        horizon: horizon,
        method: 'linear_regression',
        confidence_level: 0.95,
        filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
      },
      reason: null
    };
  }

  if (operation === 'insight_analysis') {
    const rawTarget = plan.target_measure || plan.targetMeasure || plan.measure || plan.target || plan.column;
    if (!rawTarget) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: 'Automated insight analysis requires a numerical target measure column.'
      };
    }

    const type = getColType(rawTarget);
    if (!type) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Column '${rawTarget}' does not exist in the dataset schema.`
      };
    }

    if (getColSemanticType(rawTarget) === 'identifier') {
      const validMeasure = (schemaColumns || []).find(c => isNumericType(c.type) && getColSemanticType(c.name) !== 'identifier');
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `${getCanonicalColName(rawTarget)} is an identifier column and cannot be used as a target measure for root-cause analysis. ${validMeasure ? validMeasure.name : 'Sales'} can be analyzed as a numerical measure.`
      };
    }

    if (!isNumericType(type)) {
      return {
        isValid: true,
        status: 'cannot_answer',
        plan: null,
        reason: `Automated insight analysis requires a numerical target measure. Column '${rawTarget}' is of non-numeric type '${type}'.`
      };
    }

    let rawDate = plan.date_column || plan.dateColumn;
    if (!rawDate) {
      const dateSchemaCol = (schemaColumns || []).find(c => isDateType(c.type, c.name));
      if (dateSchemaCol) rawDate = dateSchemaCol.name;
    }

    const rawDims = Array.isArray(plan.dimensions) ? plan.dimensions : (plan.dimensions ? [plan.dimensions] : []);
    const validDims = rawDims.map(d => getCanonicalColName(d)).filter(Boolean);

    // If no valid dimensions provided, default to all categorical columns
    const finalDims = validDims.length > 0 ? validDims : (schemaColumns || []).filter(c => (c.type === 'categorical' || c.type === 'text') && getColSemanticType(c.name) !== 'identifier').map(c => c.name);

    return {
      isValid: true,
      status: 'validated',
      plan: {
        operation: 'insight_analysis',
        target_measure: getCanonicalColName(rawTarget),
        targetMeasure: getCanonicalColName(rawTarget),
        measure: getCanonicalColName(rawTarget),
        target_period: plan.target_period || plan.targetPeriod || null,
        comparison_period: plan.comparison_period || plan.comparisonPeriod || null,
        dimensions: finalDims,
        date_column: rawDate ? getCanonicalColName(rawDate) : null,
        dateColumn: rawDate ? getCanonicalColName(rawDate) : null,
        focus_column: plan.focus_column ? getCanonicalColName(plan.focus_column) : null,
        focus_item: plan.focus_item || plan.focusItem || null,
        supporting_analyses: ['period_comparison', 'group_contribution', 'correlation_evidence', 'anomaly_evidence'],
        filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
      },
      reason: null
    };
  }

  // 3. Limit validation
  let parsedLimit = null;
  if (plan.limit !== undefined && plan.limit !== null) {
    parsedLimit = parseInt(plan.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      return {
        isValid: false,
        status: 'rejected',
        plan: null,
        reason: `Limit must be a positive integer. Got '${plan.limit}'.`
      };
    }
    if (parsedLimit > 1000) {
      parsedLimit = 1000; // Cap limit safely
    }
  }

  // Standardize time fields if time operation
  const isTimeOp = operation === 'time_series' || operation === 'time_group' || Boolean(plan.timeUnit) || Boolean(plan.granularity);
  const rawGran = plan.granularity || plan.timeUnit || (isTimeOp ? 'MONTH' : null);
  const normGranularity = rawGran ? String(rawGran).toUpperCase() : null;
  const dateCol = getCanonicalColName(plan.date_column || plan.column || (isTimeOp ? plan.groupBy : null));

  // Construct standardized validated plan object
  const validatedPlan = {
    operation,
    groupBy: getCanonicalColName(plan.groupBy || plan.group_by),
    measure: getCanonicalColName(targetMeasure),
    column: dateCol || getCanonicalColName(plan.column),
    date_column: dateCol || getCanonicalColName(plan.column),
    aggregation: agg || (['sum', 'average', 'median', 'min', 'max', 'count'].includes(operation) ? operation : 'sum'),
    sort: plan.sort ? plan.sort.toLowerCase() : (operation === 'top_n' ? 'descending' : operation === 'bottom_n' ? 'ascending' : null),
    limit: parsedLimit || (operation === 'top_n' || operation === 'bottom_n' ? (plan.n ? parseInt(plan.n, 10) : 5) : null),
    granularity: normGranularity,
    timeUnit: normGranularity ? normGranularity.toLowerCase() : null,
    filters: Array.isArray(plan.filters) ? plan.filters.map(f => ({ ...f, column: getCanonicalColName(f.column) })) : []
  };

  return {
    isValid: true,
    status: 'validated',
    plan: validatedPlan,
    reason: null
  };
}

module.exports = {
  validateAnalysisPlan,
  SUPPORTED_OPERATIONS,
  SUPPORTED_AGGREGATIONS
};
