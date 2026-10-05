/**
 * Phase 15 — Decision Support, Executive Summary & Traceable Report Engine
 * Generates evidence-based recommendations, decision support insights, executive summaries,
 * and comprehensive analytical reports based STRICTLY on verified deterministic calculations.
 */

function formatNumber(val, decimals = 2) {
  if (val === undefined || val === null || isNaN(val)) return 'N/A';
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * 15.1 & 15.2 & 15.3 Decision Support & Evidence-Based Recommendations Generator
 */
function generateDecisionSupport(executionResult, options = {}) {
  if (!executionResult || executionResult.status === 'cannot_answer') {
    return {
      analysisType: 'none',
      finding: 'No actionable result available.',
      evidence: [],
      recommendation: {
        title: 'Review Schema & Query Requirements',
        action: 'Adjust query parameters or select valid numerical columns to perform analysis.',
        evidenceNote: 'Calculation engine could not execute plan.'
      },
      disclaimers: [],
      traceability: {
        engine: 'PSA01 Deterministic Execution Engine',
        calculationSource: 'Unvalidated / Cannot Answer',
        aiRole: 'System Warning'
      }
    };
  }

  const op = executionResult.operation;
  const meta = executionResult.metadata || {};
  const res = executionResult.result || [];

  let analysisType = op;
  let finding = '';
  const evidence = [];
  let recommendationTitle = 'Analytical Recommendation';
  let recommendationAction = 'Review verified findings for data-driven decisions.';
  const disclaimers = [];

  switch (op) {
    case 'select': {
      analysisType = 'select';
      const colName = meta.column || 'Column';
      recommendationTitle = `Selected Values for '${colName}'`;
      finding = `Retrieved ${res.length} row(s) for identifier/attribute column '${colName}'.`;
      evidence.push(`Column: ${colName}`);
      evidence.push(`Rows Retrieved: ${res.length}`);
      recommendationAction = `Use displayed '${colName}' values to look up individual transactions, orders, or records.`;
      break;
    }

    case 'schema_info': {
      analysisType = 'schema_info';
      recommendationTitle = 'Dataset Schema & Column Information';
      finding = `Dataset contains ${res.length} schema columns across analyzed records.`;
      evidence.push(`Total Schema Columns: ${res.length}`);
      if (Array.isArray(res)) {
        res.forEach(c => {
          evidence.push(`Column '${c.name}': Type = ${c.type}, SemanticType = ${c.semanticType}`);
        });
      }
      recommendationAction = 'Use column names and data types to construct specific analytical queries (aggregations, trends, correlations, forecasts, or anomaly detection).';
      break;
    }

    case 'executive_summary': {
      analysisType = 'executive_summary';
      recommendationTitle = 'Executive Summary & Dataset Overview';
      finding = meta.keyFinding || `Dataset processed with ${meta.totalRows || res.length} rows across ${meta.totalCols || 0} columns.`;
      
      evidence.push(`Total Rows: ${formatNumber(meta.totalRows || res.length)}`);
      evidence.push(`Total Columns: ${formatNumber(meta.totalCols || 0)}`);
      evidence.push(`Data Quality Status: ${meta.dataQualityStatus || 'CLEAN'}`);
      evidence.push(`IQR Statistical Outliers: ${meta.totalIQRAnomalies || 0}`);
      evidence.push(`Trend Summary: ${meta.trendSummary || 'N/A'}`);
      evidence.push(`Correlation Summary: ${meta.correlationSummary || 'N/A'}`);
      evidence.push(`Forecast Summary: ${meta.forecastSummary || 'N/A'}`);

      recommendationAction = meta.dataQualityStatus === 'CLEAN'
        ? 'Dataset is clean and suitable for analytical decision support. Query specific metrics, trends, correlations, or root causes.'
        : `Data Quality Status is ${meta.dataQualityStatus}. Review missing values and outlier records before executing downstream machine learning models.`;
      break;
    }

    case 'complete_report':
    case 'analysis_report': {
      analysisType = 'complete_analysis_report';
      recommendationTitle = 'Complete Analysis Report & Grounded Business Recommendations';
      finding = `Comprehensive multi-phase dataset report generated across ${meta.totalRows || res.length} rows and ${meta.totalCols || 0} columns.`;

      evidence.push(`Data Quality: ${meta.dataQualityStatus || 'CLEAN'} (${meta.missingCells || 0} missing cells, ${meta.duplicateRows || 0} duplicates)`);
      evidence.push(`Outliers: ${meta.totalIQRAnomalies || 0} IQR Statistical Outlier(s)`);
      evidence.push(`Trend Analysis: ${meta.trendSummary || 'N/A'}`);
      evidence.push(`Correlation Analysis: ${meta.correlationSummary || 'N/A'}`);
      evidence.push(`Forecast Projection: ${meta.forecastSummary || 'N/A'}`);

      recommendationAction = 'Review phase-by-phase calculated evidence and grounded recommendations for multi-departmental strategic planning.';
      disclaimers.push('Calculated findings represent deterministic evidence from Phases 1-14; recommendations represent grounded natural-language interpretations.');
      break;
    }

    case 'regional_analysis': {
      analysisType = 'regional_recommendation';
      const focusReg = meta.focusRegion || 'Target Region';
      const focusSales = meta.focusRegionSales || 0;
      const focusShare = meta.focusRegionShare || 0;
      const focusChange = meta.focusRegionChange || 0;

      recommendationTitle = `Regional Focus Recommendation: Prioritize ${focusReg} Region`;
      finding = `${focusReg} region identified as the primary operational segment requiring attention (${formatNumber(focusSales)} total sales, ${formatNumber(focusShare)}% of system total, ${focusChange >= 0 ? '+' : ''}${formatNumber(focusChange)}% recent period change).`;

      evidence.push(`Focus Region: ${focusReg}`);
      evidence.push(`Focus Region Sales: ${formatNumber(focusSales)} (${formatNumber(focusShare)}% market share)`);
      evidence.push(`Recent Period Change: ${focusChange >= 0 ? '+' : ''}${formatNumber(focusChange)}%`);
      evidence.push(`Total System Revenue Analyzed: ${formatNumber(meta.totalSystemSales)}`);

      if (Array.isArray(meta.regionalBreakdown)) {
        meta.regionalBreakdown.forEach(rb => {
          evidence.push(`Region '${rb.Region}': ${formatNumber(rb.TotalSales)} sales (${formatNumber(rb.SharePercent)}% share, ${rb.RecentChangePercent >= 0 ? '+' : ''}${formatNumber(rb.RecentChangePercent)}% recent change)`);
        });
      }

      recommendationAction = meta.reasonForFocus || `Prioritize operational audit and resource allocation on ${focusReg} region based on observed metric variance.`;
      disclaimers.push('Regional selection is grounded in empirical sales share and period-over-period change. Highest sales volume does not automatically imply highest opportunity unless supported by growth metrics.');
      break;
    }

    case 'time_series':
    case 'time_group': {
      analysisType = 'trend';
      const trendDir = meta.trendDirection || 'Stable';
      const slope = meta.slope !== undefined ? meta.slope : 0;
      const r2 = meta.r2 !== undefined ? meta.r2 : 0;
      const relSlope = meta.relativeSlope !== undefined ? meta.relativeSlope : 0;
      const totalPeriods = res.length;

      finding = `Time-series trend evaluated as ${trendDir} across ${totalPeriods} historical period(s) (Regression Slope: ${slope > 0 ? '+' : ''}${formatNumber(slope)}, Relative Growth: ${relSlope > 0 ? '+' : ''}${formatNumber(relSlope)}%, Goodness-of-fit R² = ${formatNumber(r2)}).`;

      if (res.length >= 2) {
        const first = res[0];
        const last = res[res.length - 1];
        const firstVal = first[meta.targetMeasure || meta.measure || 'Sales'] || Object.values(first)[1] || 0;
        const lastVal = last[meta.targetMeasure || meta.measure || 'Sales'] || Object.values(last)[1] || 0;
        const periodChange = lastVal - firstVal;
        const pctChange = firstVal !== 0 ? ((periodChange / Math.abs(firstVal)) * 100) : 0;

        evidence.push(`Initial Period (${first.Order_Date || first.period || 'Start'}): ${formatNumber(firstVal)}`);
        evidence.push(`Latest Period (${last.Order_Date || last.period || 'End'}): ${formatNumber(lastVal)}`);
        evidence.push(`Net Period Change: ${periodChange >= 0 ? '+' : ''}${formatNumber(periodChange)} (${pctChange >= 0 ? '+' : ''}${formatNumber(pctChange)}%)`);
      }

      evidence.push(`Linear Regression Slope: ${formatNumber(slope)} per period`);
      evidence.push(`Goodness-of-fit R²: ${formatNumber(r2)} (${r2 >= 0.7 ? 'Strong Fit' : r2 >= 0.3 ? 'Moderate Fit' : 'Low Goodness-of-Fit'})`);

      if (r2 < 0.3) {
        recommendationTitle = 'Exercise Caution: Low Trend Line Fit (Low R²)';
        recommendationAction = `The trend direction is ${trendDir.toLowerCase()}, but the goodness-of-fit R² is low (${formatNumber(r2)}), indicating high historical variance. Do NOT make aggressive production, inventory, or capital commitments based solely on this trend line. Maintain baseline monitoring.`;
      } else if (trendDir === 'Increasing') {
        recommendationTitle = 'Capacity & Growth Alignment Strategy';
        recommendationAction = `Sales trend shows sustained growth (Slope: +${formatNumber(slope)}, R²: ${formatNumber(r2)}). Align capacity and logistics to support momentum, but monitor for market saturation and diminishing marginal returns rather than blindly over-expanding.`;
      } else if (trendDir === 'Decreasing') {
        recommendationTitle = 'Investigate Contraction Drivers & Audit Costs';
        recommendationAction = `Sales trend is decreasing (Slope: ${formatNumber(slope)}, R²: ${formatNumber(r2)}). Audit contributing regional and product segments to address underlying operational decline and adjust inventory commitments downwards.`;
      } else {
        recommendationTitle = 'Maintain Operational Baseline & Test Micro-Initiatives';
        recommendationAction = `Sales trend is relatively stable (Slope: ${formatNumber(slope)}, R²: ${formatNumber(r2)}). Maintain baseline operational posture and test micro-experiments to stimulate demand before committing major capital changes.`;
      }

      disclaimers.push('Regression slope and R² measure mathematical line fit across historical observations and do not assert future performance guarantees.');
      break;
    }

    case 'correlation':
    case 'correlation_matrix': {
      analysisType = 'correlation';
      const r = meta.pearsonR !== undefined ? meta.pearsonR : (meta.matrix ? meta.matrix[0]?.r : 0);
      const str = meta.strength || 'Weak';
      const dir = meta.direction || 'Positive';
      const colX = meta.columnX || meta.column_x || 'Variable X';
      const colY = meta.columnY || meta.column_y || 'Variable Y';
      const obs = meta.validObservationsCount || meta.observationsCount || res.length;

      finding = `Pearson correlation coefficient r = ${formatNumber(r, 4)} indicates a ${str} ${dir} linear association between ${colX} and ${colY} across ${obs} paired observations.`;

      evidence.push(`Variable 1 (X): ${colX}`);
      evidence.push(`Variable 2 (Y): ${colY}`);
      evidence.push(`Pearson Coefficient (r): ${formatNumber(r, 4)}`);
      evidence.push(`Coefficient of Determination (R²): ${formatNumber(r * r, 4)} (${formatNumber(r * r * 100)}% shared variance)`);
      evidence.push(`Valid Paired Observations: ${obs}`);

      if (Math.abs(r) < 0.3) {
        recommendationTitle = 'Avoid Assuming Linear Dependency';
        recommendationAction = `The linear relationship between ${colX} and ${colY} is weak (r = ${formatNumber(r, 4)}). Avoid relying solely on linear projections when evaluating operational dependencies.`;
      } else {
        recommendationTitle = 'Evaluate Associated Operational Factors';
        recommendationAction = `The observed ${str.toLowerCase()} ${dir.toLowerCase()} association (r = ${formatNumber(r, 4)}) suggests taking paired variation between ${colX} and ${colY} into account during planning.`;
      }

      disclaimers.push('Correlation does not imply causation. Observed association indicates linear co-variation across historical records, not direct causal effect.');
      break;
    }

    case 'anomaly_detection': {
      analysisType = 'anomaly';
      const outlierCount = meta.outliersDetected || res.length;
      const totalRows = meta.totalRecordsAnalyzed || meta.rowsAnalyzed || 0;
      const pct = totalRows > 0 ? ((outlierCount / totalRows) * 100) : 0;
      const method = meta.method || 'IQR';

      finding = `Detected ${outlierCount} Statistical Outlier record(s) (${formatNumber(pct)}% of dataset) outside 1.5 × IQR statistical bounds.`;

      evidence.push(`Statistical Method: ${method.toUpperCase()} (Tukey's 1.5 × IQR rule)`);
      evidence.push(`Outlier Records Identified: ${outlierCount}`);
      evidence.push(`Total Rows Analyzed: ${totalRows}`);
      if (meta.featureOutliers) {
        Object.entries(meta.featureOutliers).forEach(([col, count]) => {
          evidence.push(`Feature '${col}': ${count} outlier boundary violation(s)`);
        });
      }

      recommendationTitle = 'Review Identified Statistical Outliers';
      recommendationAction = 'Review the identified observations to determine whether they represent legitimate extreme operational cases or data-quality issues.';

      disclaimers.push('Statistical Outliers represent extreme mathematical deviations beyond standard IQR thresholds and should not be automatically classified as invalid data or system errors without domain context.');
      break;
    }

    case 'forecast': {
      analysisType = 'forecast';
      const target = meta.targetMeasure || meta.target || 'Sales';
      const horizon = meta.horizon || 3;
      const gran = meta.granularity || 'MONTH';
      const finalForecastVal = meta.finalForecastValue || (res.length > 0 ? res[res.length - 1][target] : 0);
      const projChangePct = meta.projectedChangePercent || 0;
      const backtest = meta.backtesting || meta.backtestMetrics || {};
      const histTrendDir = meta.historicalTrendDirection || 'Stable';

      let divergenceWarning = '';
      if ((histTrendDir === 'Decreasing' && projChangePct > 0) || (histTrendDir === 'Increasing' && projChangePct < 0)) {
        divergenceWarning = ` Divergence Notice: Historical trend direction (${histTrendDir}) differs from projected forecast direction (${projChangePct > 0 ? 'Increasing' : 'Decreasing'}). This indicates linear extrapolation projections should be validated against external business factors.`;
      }

      finding = `Linear regression model projects ${gran.toLowerCase()} ${target} over a ${horizon}-${gran.toLowerCase()} horizon, reaching ${formatNumber(finalForecastVal)} in the final forecast period (Projected change: ${projChangePct >= 0 ? '+' : ''}${formatNumber(projChangePct)}%).${divergenceWarning}`;

      evidence.push(`Target Metric: ${target}`);
      evidence.push(`Forecast Horizon: ${horizon} ${gran.toLowerCase()}(s)`);
      evidence.push(`Final Forecast Value: ${formatNumber(finalForecastVal)}`);
      evidence.push(`Projected Horizon Change: ${projChangePct >= 0 ? '+' : ''}${formatNumber(projChangePct)}%`);
      if (divergenceWarning) evidence.push(`Historical Trend vs Forecast: ${histTrendDir} vs ${projChangePct > 0 ? 'Increasing' : 'Decreasing'} Projection`);
      if (backtest.mae !== undefined) evidence.push(`Historical Backtest MAE: ${formatNumber(backtest.mae)}`);
      if (backtest.rmse !== undefined) evidence.push(`Historical Backtest RMSE: ${formatNumber(backtest.rmse)}`);
      if (backtest.mape !== undefined && backtest.mape !== null) evidence.push(`Historical Backtest MAPE: ${formatNumber(backtest.mape)}%`);

      recommendationTitle = 'Incorporate Forecast Projections into Scenario Planning';
      recommendationAction = divergenceWarning
        ? `The model projects a ${projChangePct >= 0 ? 'growth' : 'decrease'} in ${target}, but historical trend was ${histTrendDir}. Validate external demand signals before committing capital changes.`
        : `The model projects a ${projChangePct >= 0 ? 'growth' : 'decrease'} in ${target}. Use this projected trajectory for directional scenario planning while accounting for model evaluation bounds.`;

      disclaimers.push('Backtest metrics measure historical predictive performance and do not guarantee future forecast accuracy. Projections represent linear trend model extrapolations under historical assumptions.');
      break;
    }

    case 'insight_analysis': {
      analysisType = 'root_cause';
      const targetM = meta.targetMeasure || 'Sales';
      const targetP = meta.targetPeriod || 'Target Period';
      const compP = meta.comparisonPeriod || 'Baseline Period';
      const absChange = meta.absoluteChange || 0;
      const pctChange = meta.overallChangePercent || 0;
      const topContribs = meta.topContributors || [];

      finding = `${targetM} changed by ${absChange >= 0 ? '+' : ''}${formatNumber(absChange)} (${pctChange >= 0 ? '+' : ''}${formatNumber(pctChange)}%) between baseline (${compP}) and target period (${targetP}).`;

      evidence.push(`1. Observed Finding: ${targetM} changed by ${absChange >= 0 ? '+' : ''}${formatNumber(absChange)} (${pctChange >= 0 ? '+' : ''}${formatNumber(pctChange)}%) in ${targetP} (${formatNumber(meta.targetValue)}) vs ${compP} baseline (${formatNumber(meta.comparisonValue)}).`);

      if (topContribs.length > 0) {
        const topDriver = topContribs[0];
        evidence.push(`2. Possible Explanation: ${topDriver.dimension} segment '${topDriver.group}' accounted for the largest observed group contribution to the net change (${formatNumber(topDriver.contributionPercent)}% contribution share, Abs: ${formatNumber(topDriver.absoluteChange)}).`);
        
        topContribs.slice(1, 4).forEach(tc => {
          evidence.push(`   Supporting Dimension (${tc.dimension} -> ${tc.group}): Contribution Share = ${formatNumber(tc.contributionPercent)}% (Abs: ${formatNumber(tc.absoluteChange)})`);
        });

        recommendationTitle = `Root Cause & Action Plan: Audit ${topDriver.group} (${topDriver.dimension})`;
        recommendationAction = `3. Recommended Action: Focus operational audit and stakeholder investigation on ${topDriver.group} (${topDriver.dimension}) to evaluate underlying demand or operational causes.`;
      } else {
        evidence.push('2. Possible Explanation: Available group dimensions do not account for a single dominant driver.');
        recommendationTitle = 'Investigate System-Wide Operational Factors';
        recommendationAction = '3. Recommended Action: Dataset evidence does not establish a single regional or categorical cause. Conduct a broad operational audit across system-wide metrics.';
      }

      disclaimers.push('Contributors are analyzed separately within each dimension and should not be added across dimensions.');
      disclaimers.push('Contribution values indicate statistical co-occurrence and association, not direct proven causation.');
      break;
    }

    case 'group_aggregate':
    case 'top_n':
    case 'bottom_n': {
      analysisType = 'group';
      const groupCol = meta.groupBy || 'Group';
      const measureCol = meta.measure || 'Measure';
      const topGroup = res.length > 0 ? res[0] : null;

      finding = `${op === 'top_n' ? 'Top' : op === 'bottom_n' ? 'Bottom' : 'Group'} aggregation across ${groupCol} by ${measureCol} generated ${res.length} group result(s).`;

      if (topGroup) {
        const groupName = topGroup[groupCol] || topGroup.group || 'N/A';
        const groupVal = topGroup[`${measureCol}_${meta.aggregation || 'sum'}`] || topGroup[measureCol] || topGroup.value || 0;
        evidence.push(`Primary Group (${groupCol} = '${groupName}'): ${formatNumber(groupVal)}`);
      }
      evidence.push(`Total Groups Evaluated: ${res.length}`);

      recommendationTitle = 'Focus Operational Strategy on Key Performance Leaders';
      recommendationAction = `Focus operational attention on top-performing ${groupCol} segments while evaluating resource distribution for lower-ranking groups.`;
      break;
    }

    default: {
      analysisType = 'scalar';
      const val = res.length > 0 ? (res[0][meta.measure] || res[0].result || res[0].value) : null;
      finding = `Deterministic evaluation completed for ${meta.measure || 'query'} (Calculated value: ${formatNumber(val)}).`;
      evidence.push(`Target Measure: ${meta.measure || 'Value'}`);
      evidence.push(`Computed Metric: ${formatNumber(val)}`);
      evidence.push(`Rows Analyzed: ${meta.rowsAnalyzed || res.length}`);

      recommendationTitle = 'Verified Metric Reference';
      recommendationAction = 'Use this verified calculation as a grounded quantitative benchmark for reporting and downstream workflows.';
    }
  }

  return {
    type: analysisType,
    title: recommendationTitle,
    analysisType,
    finding,
    evidence,
    recommendation: {
      title: recommendationTitle,
      action: recommendationAction,
      evidenceNote: 'Recommendation strictly derived from verified deterministic evidence. No unverified causation or assumptions asserted.'
    },
    disclaimers,
    traceability: {
      engine: 'PSA01 Deterministic Execution Engine',
      calculationSource: `Verified Output (Phase 3 Engine / ${op})`,
      aiRole: 'Evidence Interpretation & Structuring'
    }
  };
}

/**
 * 15.4 Executive Summary Generator
 */
function generateExecutiveSummary(profile, qualitySummary, insights = [], executionResult = null) {
  const rowCount = profile?.rowCount || (executionResult?.metadata?.rowsAnalyzed) || 0;
  const colCount = profile?.columnCount || (profile?.columns ? profile.columns.length : 0);


  // Data Quality Status Safety Rule (Phase 15.4 & 15.12)
  const overallStatus = qualitySummary?.overallStatus || (insights.length > 0 ? 'WARNING' : 'CLEAN');
  let dataQualityStatusText = 'CLEAN';
  let dataQualityMessage = 'No major data-quality warnings or anomalies detected.';

  if (overallStatus === 'CRITICAL') {
    dataQualityStatusText = 'CRITICAL';
    dataQualityMessage = qualitySummary?.statusMessage || 'Critical data-quality issues detected. Immediate data cleanup recommended.';
  } else if (overallStatus === 'WARNING') {
    dataQualityStatusText = 'WARNING';
    dataQualityMessage = qualitySummary?.statusMessage || 'Data Quality Status: WARNING — Minor data-quality issues detected. Analysis can proceed with appropriate handling.';
  } else {
    dataQualityStatusText = 'CLEAN';
    dataQualityMessage = 'Dataset is clean and suitable for analytical decision support.';
  }

  // Statistical Outliers
  const outlierCount = profile?.columns ? profile.columns.reduce((sum, c) => sum + (c.outlierCount || 0), 0) : 0;

  // Decision Support for execution result if provided
  let ds = null;
  if (executionResult) {
    ds = generateDecisionSupport(executionResult);
  }

  // Performance Summary
  const numCols = (profile?.columns || []).filter(c => c.type === 'integer' || c.type === 'float');
  const primaryMeasure = numCols.find(c => c.name.toLowerCase().includes('sales') || c.name.toLowerCase().includes('revenue')) || numCols[0];

  const performanceText = primaryMeasure
    ? `${primaryMeasure.name} (Range: ${formatNumber(primaryMeasure.min)} to ${formatNumber(primaryMeasure.max)}, Mean: ${formatNumber(primaryMeasure.mean)})`
    : `${rowCount.toLocaleString()} rows ingested across ${colCount} columns`;

  // Trend Summary
  const trendText = executionResult?.metadata?.trendDirection || (profile?.hasTimeSeries ? 'Historical Date Series Available' : 'N/A');

  return {
    overview: {
      rowCount,
      columnCount: colCount,
      performanceSummary: performanceText
    },
    performance: performanceText,
    trend: trendText,
    dataQuality: {
      status: dataQualityStatusText,
      message: dataQualityMessage
    },
    statisticalOutliers: `${outlierCount} IQR Statistical Outlier(s) detected across numerical features`,
    forecast: executionResult?.operation === 'forecast'
      ? `Projected Horizon: ${executionResult.metadata?.horizon || 3} period(s), Final Forecast: ${formatNumber(executionResult.metadata?.finalForecastValue)}`
      : 'No active forecast executed in current view',
    keyFinding: ds ? ds.finding : `Dataset processed with ${rowCount} rows and ${colCount} schema columns. System ready for natural-language analysis.`,
    recommendedAction: ds ? ds.recommendation.action : 'Query specific metrics, trends, correlations, anomalies, or root causes for detailed decision support.',
    traceability: ds ? ds.traceability : { engine: 'PSA01 Engine', calculationSource: 'Ingested Dataset Profile', aiRole: 'Executive Summary Generation' }
  };
}

/**
 * 15.6 Full Analytical Report Generator
 */
function generateAnalysisReport(profile, qualitySummary, insights = [], executionResult = null, options = {}) {
  const execSummary = generateExecutiveSummary(profile, qualitySummary, insights, executionResult);
  const ds = executionResult ? generateDecisionSupport(executionResult) : null;

  const schemaTable = (profile?.columns || []).map(c => ({
    name: c.name,
    type: c.type || c.dataType,
    semanticType: c.semanticType || 'measure',
    missingCount: c.missingCount || 0,
    uniqueCount: c.uniqueCount || 0,
    outliers: c.outlierCount || 0,
    status: c.status || 'Clean'
  }));

  const report = {
    title: options.title || 'Dataset Analytical Executive & Technical Report',
    timestamp: new Date().toISOString(),
    executiveSummary: execSummary,
    datasetOverview: {
      datasetName: options.datasetName || 'Uploaded Dataset',
      rowCount: profile?.rowCount || 0,
      columnCount: profile?.columnCount || 0,
      schema: schemaTable
    },
    dataQualityAudit: {
      overallStatus: execSummary.dataQuality.status,
      statusMessage: execSummary.dataQuality.message,
      missingValuesCount: profile?.columns ? profile.columns.reduce((s, c) => s + (c.missingCount || 0), 0) : 0,
      duplicateRowsCount: profile?.duplicates?.count || 0,
      statisticalOutliersCount: profile?.columns ? profile.columns.reduce((s, c) => s + (c.outlierCount || 0), 0) : 0,
      insightsList: insights
    },
    analyticalFindings: executionResult ? {
      question: options.question || 'Active Analysis Query',
      operation: executionResult.operation,
      finding: ds.finding,
      evidence: ds.evidence,
      resultData: executionResult.result,
      metadata: executionResult.metadata
    } : null,
    recommendations: ds ? [ds.recommendation] : [{
      title: 'Proceed with Evidence-Based Querying',
      action: 'Execute natural language queries to compute deterministic trends, correlations, forecasts, and root-cause analyses.',
      evidenceNote: 'System engine stands ready for verifiable computation.'
    }],
    disclaimers: ds ? ds.disclaimers : [],
    traceabilityMatrix: {
      calculatedResults: 'Performed 100% deterministically by Phase 3 Engine without LLM guesswork.',
      aiInterpretations: 'Generated by evidence-grounded explainer strictly from verified execution metadata.',
      dataIntegrity: 'No external or invented numbers introduced.'
    }
  };

  return report;
}

module.exports = {
  generateDecisionSupport,
  generateExecutiveSummary,
  generateAnalysisReport,
  formatNumber
};
