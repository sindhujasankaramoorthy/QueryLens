/**
 * Deterministic Chart Selection Engine for PSA01 (Phase 4)
 * Analyzes Phase 3 execution output and plan to select the optimal chart type.
 * Ensures 100% data safety: uses ONLY raw result data without recalculation or fabrication.
 */

function determineVisualization(executionResult, plan = null) {
  if (!executionResult || executionResult.status !== 'success' || !Array.isArray(executionResult.result)) {
    return {
      chartType: 'none',
      shouldRenderChart: false,
      reason: 'No valid execution result available.'
    };
  }

  const resultData = executionResult.result;
  if (resultData.length === 0) {
    return {
      chartType: 'none',
      shouldRenderChart: false,
      reason: 'Result set is empty.'
    };
  }

  const operation = (executionResult.operation || plan?.operation || '').toLowerCase().trim();
  const firstRow = resultData[0];
  const keys = Object.keys(firstRow);

  // Single scalar result check (e.g. [{ Sales: 723000 }] or [{ count: 20 }])
  if (resultData.length === 1 && keys.length === 1 && typeof firstRow[keys[0]] === 'number') {
    return {
      chartType: 'none',
      shouldRenderChart: false,
      isScalar: true,
      scalarKey: keys[0],
      scalarValue: firstRow[keys[0]],
      reason: 'Scalar result represented as KPI card.'
    };
  }

  // Scalar operations list
  const scalarOps = new Set(['count', 'sum', 'average', 'median', 'min', 'max', 'describe']);
  if (scalarOps.has(operation) && resultData.length <= 1) {
    const numKey = keys.find(k => typeof firstRow[k] === 'number') || keys[0];
    return {
      chartType: 'none',
      shouldRenderChart: false,
      isScalar: true,
      scalarKey: numKey,
      scalarValue: firstRow[numKey],
      reason: 'Scalar operation result represented as KPI card.'
    };
  }

  // Determine xKey and yKey dynamically for generic arbitrary datasets
  let xKey = null;
  let yKey = null;

  // Prefer explicit plan fields if available
  if (plan?.column || plan?.groupBy) {
    xKey = plan.column || plan.groupBy;
  }

  // Auto-detect xKey from result row if not found or if keys in result differ
  if (!xKey || !(xKey in firstRow)) {
    // Find first non-numeric key in firstRow (e.g., Region, Product, Order_Date)
    xKey = keys.find(k => typeof firstRow[k] !== 'number') || keys[0];
  }

  // Find yKey (numerical measure key)
  if (plan?.measure) {
    const aggSuffix = `${plan.measure}_${plan.aggregation || 'sum'}`;
    if (aggSuffix in firstRow) {
      yKey = aggSuffix;
    } else if (plan.measure in firstRow) {
      yKey = plan.measure;
    }
  }

  if (!yKey || !(yKey in firstRow)) {
    // Find first key with numerical value that is not xKey
    yKey = keys.find(k => k !== xKey && typeof firstRow[k] === 'number') || keys.find(k => typeof firstRow[k] === 'number');
  }

  // If no numerical yKey exists, chart cannot be rendered
  if (!yKey || typeof firstRow[yKey] !== 'number') {
    return {
      chartType: 'none',
      shouldRenderChart: false,
      reason: 'No numerical measure column found for chart Y-axis.'
    };
  }

  // Chart selection logic based on operation type
  if (operation === 'time_series' || operation === 'time_group' || plan?.timeUnit || plan?.granularity) {
    return {
      chartType: 'line',
      shouldRenderChart: true,
      xKey,
      yKey,
      title: `${yKey.replace(/_/g, ' ')} over ${xKey.replace(/_/g, ' ')}`,
      chartData: resultData
    };
  }

  if (operation === 'correlation') {
    const meta = executionResult.metadata || {};
    return {
      chartType: 'scatter',
      shouldRenderChart: true,
      xKey: meta.columnX || plan?.column_x || plan?.column || 'x',
      yKey: meta.columnY || plan?.column_y || plan?.measure || 'y',
      title: `Scatter Plot: ${meta.columnY || 'Y'} vs ${meta.columnX || 'X'}`,
      scatterPoints: meta.scatterPoints || [],
      pearsonR: meta.pearsonR,
      direction: meta.direction,
      strength: meta.strength,
      chartData: meta.scatterPoints || []
    };
  }

  if (operation === 'correlation_matrix') {
    const meta = executionResult.metadata || {};
    return {
      chartType: 'correlation_matrix',
      shouldRenderChart: true,
      title: meta.targetColumn ? `Factors Correlated with ${meta.targetColumn}` : 'Correlation Matrix',
      columns: meta.columns || [],
      matrixMap: meta.matrixMap || {},
      targetColumn: meta.targetColumn || null,
      targetFactors: meta.targetFactors || null,
      topPair: meta.topPair || null,
      chartData: resultData
    };
  }

  if (operation === 'anomaly_detection') {
    const meta = executionResult.metadata || {};
    return {
      chartType: 'anomaly_detection',
      shouldRenderChart: true,
      title: 'Statistical Outlier Detection (Phase 7 IQR)',
      features: meta.features || [],
      featureX: meta.featureX || 'X',
      featureY: meta.featureY || 'Y',
      scatterPoints: meta.scatterPoints || [],
      anomaliesDetected: meta.anomaliesDetected || 0,
      normalRecords: meta.normalRecords || 0,
      anomalyRate: meta.anomalyRate || 0,
      chartData: resultData
    };
  }

  if (['group_aggregate', 'top_n', 'bottom_n', 'sort'].includes(operation)) {
    return {
      chartType: 'bar',
      shouldRenderChart: true,
      xKey,
      yKey,
      title: `${yKey.replace(/_/g, ' ')} by ${xKey.replace(/_/g, ' ')}`,
      chartData: resultData
    };
  }

  // Fallback for multi-row tabular results
  if (resultData.length > 1) {
    return {
      chartType: 'bar',
      shouldRenderChart: true,
      xKey,
      yKey,
      title: `${yKey.replace(/_/g, ' ')} breakdown`,
      chartData: resultData
    };
  }

  return {
    chartType: 'none',
    shouldRenderChart: false,
    reason: 'Result does not require charting.'
  };
}

module.exports = {
  determineVisualization
};
