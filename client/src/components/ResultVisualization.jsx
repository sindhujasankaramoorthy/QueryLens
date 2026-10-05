import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Calculator, Layers, TrendingUp, BarChart3, ScatterChart as ScatterIcon, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/**
 * Format numbers cleanly (e.g. currency/thousands formatting)
 */
function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return String(val);
}

/**
 * Format key names for clean table & axis labels (e.g. Sales_sum -> Sales (Sum))
 */
function formatLabel(key) {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, l => l.toUpperCase());
}

export default function ResultVisualization({ execution, validation, question, theme = 'dark' }) {
  if (!execution || execution.status !== 'success' || !Array.isArray(execution.result)) {
    return null;
  }

  const resultData = execution.result;
  const metadata = execution.metadata || {};
  const operation = (execution.operation || validation?.plan?.operation || 'analysis').toLowerCase();

  // Determine scalar vs correlation vs time series vs chart dynamically
  const firstRow = resultData[0] || {};
  const keys = Object.keys(firstRow);

  const isCorrelation = operation === 'correlation' || firstRow.correlation !== undefined || firstRow.pearsonR !== undefined;
  const isCorrelationMatrix = operation === 'correlation_matrix';
  const isAnomalyDetection = operation === 'anomaly_detection';
  const isForecast = operation === 'forecast';

  const colX = metadata.columnX || firstRow.columnX;
  const colY = metadata.columnY || firstRow.columnY;
  const pearsonR = metadata.pearsonR !== undefined ? metadata.pearsonR : firstRow.pearsonR !== undefined ? firstRow.pearsonR : firstRow.correlation;
  const rawR = metadata.rawR !== undefined ? metadata.rawR : firstRow.rawR !== undefined ? firstRow.rawR : pearsonR;
  const direction = metadata.direction || firstRow.direction || (rawR > 0 ? 'Positive' : rawR < 0 ? 'Negative' : 'No linear relationship');
  const strength = metadata.strength || firstRow.strength || 'Moderate';
  const obsCount = metadata.observations || firstRow.observations || metadata.rowsAnalyzed;
  const missingPairsCount = metadata.missingPairsExcluded !== undefined ? metadata.missingPairsExcluded : metadata.missingValuesIgnored || 0;

  const scatterData = metadata.scatterPoints || (metadata.topPair ? metadata.topPair.scatterPoints : []);
  const scatterColX = colX || (metadata.topPair ? metadata.topPair.columnX : 'Variable X');
  const scatterColY = colY || (metadata.topPair ? metadata.topPair.columnY : 'Variable Y');

  const isTimeSeries = !isCorrelation && !isCorrelationMatrix && !isForecast && (operation === 'time_series' || operation === 'time_group' || Boolean(metadata?.dateColumn) || Boolean(validation?.plan?.granularity) || Boolean(validation?.plan?.timeUnit));

  // Auto detect xKey and yKey for non-correlation charts
  let xKey = metadata?.dateColumn || validation?.plan?.date_column || validation?.plan?.column || validation?.plan?.groupBy;
  if (!xKey || !(xKey in firstRow)) {
    xKey = keys.find(k => typeof firstRow[k] !== 'number') || keys[0];
  }

  let yKey = null;
  if (metadata?.measureColumn || validation?.plan?.measure || metadata?.targetColumn || metadata?.target) {
    const targetM = metadata?.measureColumn || validation?.plan?.measure || metadata?.targetColumn || metadata?.target;
    const aggSuffix = `${targetM}_${validation?.plan?.aggregation || 'sum'}`;
    if (aggSuffix in firstRow) {
      yKey = aggSuffix;
    } else if (targetM in firstRow) {
      yKey = targetM;
    }
  }

  if (!yKey || !(yKey in firstRow)) {
    yKey = keys.find(k => k !== xKey && k !== 'Growth (%)' && typeof firstRow[k] === 'number') || keys.find(k => typeof firstRow[k] === 'number');
  }

  const isScalar = !isCorrelation && !isCorrelationMatrix && !isTimeSeries && !isForecast && resultData.length === 1 && (keys.length === 1 || ['count', 'sum', 'average', 'median', 'min', 'max', 'describe'].includes(operation));
  const shouldChart = !isScalar && !isCorrelation && !isCorrelationMatrix && !isForecast && resultData.length > 1 && Boolean(yKey);

  // Theme-aware color variables for Recharts
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipTextColor = isDark ? '#f8fafc' : '#0f172a';

  // Distinct palette for multi-line grouped trends
  const lineColors = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

  // Trend direction badge styling
  const trendDir = metadata.trendDirection || 'Relatively stable';
  const trendBadgeStyle = {
    Increasing: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', icon: ArrowUpRight, border: '1px solid rgba(16, 185, 129, 0.3)' },
    Decreasing: { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', icon: ArrowDownRight, border: '1px solid rgba(244, 63, 94, 0.3)' },
    'Relatively stable': { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', icon: Minus, border: '1px solid rgba(6, 182, 212, 0.3)' },
    'Insufficient data': { bg: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)', icon: Minus, border: '1px solid rgba(148, 163, 184, 0.3)' }
  }[trendDir] || { bg: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', icon: Minus, border: '1px solid rgba(6, 182, 212, 0.3)' };

  const TrendIcon = trendBadgeStyle.icon;

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {/* 1. Pairwise Correlation Analysis Result Card */}
      {isCorrelation && (
        <div>
          <div
            style={{
              background: isDark ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 182, 212, 0.08))' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(6, 182, 212, 0.05))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Activity size={22} style={{ color: 'var(--accent-violet)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-violet)' }}>
                  Pearson Correlation Analysis
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-violet)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  Direction: {direction}
                </span>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                  Strength: {strength}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                {rawR >= 0 ? `+${typeof pearsonR === 'number' ? pearsonR.toFixed(2) : pearsonR}` : (typeof pearsonR === 'number' ? pearsonR.toFixed(2) : pearsonR)}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {colX} vs {colY}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <span>Rows Analyzed: <strong style={{ color: 'var(--text-main)' }}>{metadata.rowsAnalyzed}</strong></span>
              <span>Paired Observations: <strong style={{ color: 'var(--text-main)' }}>{obsCount}</strong></span>
              <span>Missing Pairs Excluded: <strong style={{ color: 'var(--text-main)' }}>{missingPairsCount}</strong></span>
              <span>Method: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Pearson</strong></span>
              <span>Calculation: <strong style={{ color: 'var(--accent-emerald)' }}>100% Verifiable Deterministic</strong></span>
            </div>
          </div>

          {/* Scatter Plot Chart */}
          {scatterData && scatterData.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScatterIcon size={20} style={{ color: 'var(--secondary)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Scatter Plot ({scatterColX} vs {scatterColY})
                  </h4>
                </div>
                <span className="type-tag">Scatter Plot ({scatterData.length} points | Pearson r = {rawR >= 0 ? `+${typeof pearsonR === 'number' ? pearsonR.toFixed(2) : pearsonR}` : pearsonR})</span>
              </div>

              <div style={{ width: '100%', height: 320, marginTop: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="x"
                      name={scatterColX}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(scatterColX), position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="y"
                      name={scatterColY}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(scatterColY), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                      formatter={(val, name, item) => [
                        formatValue(val),
                        formatLabel(item?.dataKey === 'x' ? scatterColX : (item?.dataKey === 'y' ? scatterColY : name))
                      ]}
                    />
                    <Scatter name="Observations" data={scatterData} fill="var(--primary)" opacity={0.85} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Correlation Matrix & Target Factors Result View */}
      {isCorrelationMatrix && (
        <div>
          {/* Target Variable Factors Card */}
          {metadata.targetColumn && metadata.targetFactors && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Activity size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Factors Correlated with {metadata.targetColumn}
                </h4>
              </div>

              <div className="table-wrapper">
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th style={{ textAlign: 'right' }}>Pearson r</th>
                      <th>Direction</th>
                      <th>Strength</th>
                      <th style={{ textAlign: 'right' }}>Observations</th>
                      <th style={{ textAlign: 'right' }}>Missing Pairs Excluded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metadata.targetFactors.map((tf, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tf.variable}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: tf.rawR > 0 ? 'var(--accent-emerald)' : tf.rawR < 0 ? 'var(--accent-rose)' : 'inherit' }}>
                          {tf.pearsonR}
                        </td>
                        <td>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, background: tf.rawR > 0 ? 'rgba(16, 185, 129, 0.15)' : tf.rawR < 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: tf.rawR > 0 ? 'var(--accent-emerald)' : tf.rawR < 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                            {tf.direction}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{tf.strength}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{tf.observations}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{tf.missingPairsExcluded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full Matrix Heatmap Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Correlation Matrix Heatmap
                </h4>
              </div>
              <span className="type-tag">Pearson Correlation Matrix ({metadata.columns?.length || 0} Measures)</span>
            </div>

            <div className="table-wrapper">
              <table className="profile-table" style={{ borderCollapse: 'separate', borderSpacing: '2px' }}>
                <thead>
                  <tr>
                    <th>Measure</th>
                    {(metadata.columns || keys.filter(k => k !== 'Variable')).map(c => (
                      <th key={c} style={{ textAlign: 'center' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.Variable || keys[idx]}</td>
                      {(metadata.columns || keys.filter(k => k !== 'Variable')).map(c => {
                        const val = row[c];
                        const numVal = typeof val === 'number' ? val : parseFloat(val);
                        const isDiag = row.Variable === c || numVal === 1;

                        let cellBg = 'transparent';
                        let textColor = 'var(--text-main)';

                        if (!isNaN(numVal)) {
                          if (isDiag) {
                            cellBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                            textColor = 'var(--text-muted)';
                          } else if (numVal > 0) {
                            const alpha = Math.min(0.35, Math.max(0.1, numVal * 0.35));
                            cellBg = `rgba(16, 185, 129, ${alpha})`;
                            textColor = 'var(--accent-emerald)';
                          } else if (numVal < 0) {
                            const alpha = Math.min(0.35, Math.max(0.1, Math.abs(numVal) * 0.35));
                            cellBg = `rgba(244, 63, 94, ${alpha})`;
                            textColor = 'var(--accent-rose)';
                          }
                        }

                        return (
                          <td
                            key={c}
                            style={{
                              textAlign: 'center',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: isDiag ? 600 : 800,
                              background: cellBg,
                              color: textColor,
                              borderRadius: '4px',
                              padding: '0.6rem 0.5rem'
                            }}
                          >
                            {typeof numVal === 'number' && !isNaN(numVal) ? (numVal >= 0 ? `+${numVal.toFixed(2)}` : numVal.toFixed(2)) : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
              <span>Rows Analyzed: <strong style={{ color: 'var(--text-main)' }}>{metadata.rowsAnalyzed}</strong></span>
              <span>Missing Pairs Excluded: <strong style={{ color: 'var(--text-main)' }}>{missingPairsCount}</strong></span>
              <span>Method: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Pearson Correlation Matrix</strong></span>
              <span>Calculation: <strong style={{ color: 'var(--accent-emerald)' }}>Symmetric & Deterministic</strong></span>
            </div>
          </div>

          {/* Scatter Plot for Top Correlated Pair if available */}
          {scatterData && scatterData.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScatterIcon size={20} style={{ color: 'var(--secondary)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Top Pair Scatter Plot ({scatterColX} vs {scatterColY})
                  </h4>
                </div>
                <span className="type-tag">Scatter Plot ({scatterData.length} points)</span>
              </div>

              <div style={{ width: '100%', height: 320, marginTop: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="x"
                      name={scatterColX}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(scatterColX), position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="y"
                      name={scatterColY}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(scatterColY), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                      formatter={(val, name, item) => [
                        formatValue(val),
                        formatLabel(item?.dataKey === 'x' ? scatterColX : (item?.dataKey === 'y' ? scatterColY : name))
                      ]}
                    />
                    <Scatter name="Observations" data={scatterData} fill="var(--primary)" opacity={0.85} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Statistical Anomaly Detection View (Phase 7 IQR) */}
      {isAnomalyDetection && (
        <div>
          {/* Anomaly Summary Banner */}
          <div
            style={{
              background: isDark ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(245, 158, 11, 0.08))' : 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(245, 158, 11, 0.05))',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={22} style={{ color: 'var(--accent-rose)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-rose)' }}>
                  Statistical Outlier Detection (Phase 7 IQR)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  Statistical Outliers: {metadata.anomaliesDetected || 0}
                </span>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Within IQR Bounds: {metadata.normalRecords || 0}
                </span>
              </div>
            </div>

            {/* Explanatory Distinction Banner */}
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.2)', border: '1px dashed rgba(255, 255, 255, 0.15)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--accent-amber)' }}>Statistical Outlier Detection (Phase 7 IQR):</strong> Reuses the standard Phase 7 Interquartile Range method [Q1 - 1.5xIQR, Q3 + 1.5xIQR] to identify records containing statistically extreme values without treating them as invalid errors.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Total Records</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{metadata.totalRecords || resultData.length}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Rows Analyzed</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{metadata.rowsAnalyzed || resultData.length}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Rows Excluded</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{metadata.rowsExcluded || 0}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Outlier Rate</div>
                <strong style={{ color: 'var(--accent-rose)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{metadata.anomalyRate || 0}%</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>IQR Multiplier</div>
                <strong style={{ color: 'var(--primary)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>1.5x</strong>
              </div>
            </div>
          </div>

          {/* Anomaly Scatter Plot */}
          {metadata.scatterPoints && metadata.scatterPoints.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScatterIcon size={20} style={{ color: 'var(--accent-rose)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Statistical Outlier Scatter Plot ({metadata.featureX} vs {metadata.featureY})
                  </h4>
                </div>
                <span className="type-tag">Phase 7 IQR ({metadata.scatterPoints.length} points)</span>
              </div>

              <div style={{ width: '100%', height: 340, marginTop: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="x"
                      name={metadata.featureX}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(metadata.featureX), position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="y"
                      name={metadata.featureY}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(metadata.featureY), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                      formatter={(val, name, item) => [
                        formatValue(val),
                        formatLabel(item?.dataKey === 'x' ? metadata.featureX : (item?.dataKey === 'y' ? metadata.featureY : name))
                      ]}
                    />
                    <Scatter
                      name="Within Bounds"
                      data={metadata.scatterPoints.filter(p => p.status === 'Within Bounds')}
                      fill="var(--primary)"
                      opacity={0.75}
                    />
                    <Scatter
                      name="Statistical Outliers"
                      data={metadata.scatterPoints.filter(p => p.status === 'Statistical Outlier')}
                      fill="#f43f5e"
                      shape="diamond"
                      size={80}
                      opacity={0.95}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Anomaly Results Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Statistical Outlier Records ({resultData.length} Records)
                </h4>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="profile-table">
                <thead>
                  <tr>
                    {keys.map(key => (
                      <th key={key} style={{ textAlign: typeof firstRow[key] === 'number' ? 'right' : 'left' }}>{formatLabel(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultData.map((row, idx) => {
                    const isOutlier = row['Outlier Status'] === 'Statistical Outlier';
                    return (
                      <tr key={idx} style={{ background: isOutlier ? (isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.05)') : 'transparent' }}>
                        {keys.map((key, cIdx) => {
                          const rawVal = row[key];
                          const isStatus = key === 'Outlier Status';

                          if (isStatus) {
                            return (
                              <td key={cIdx}>
                                <span style={{ padding: '0.2rem 0.55rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, background: isOutlier ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.15)', color: isOutlier ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                                  {rawVal}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={cIdx}
                              style={{
                                textAlign: typeof rawVal === 'number' ? 'right' : 'left',
                                fontFamily: typeof rawVal === 'number' ? 'var(--font-mono)' : 'inherit',
                                fontWeight: typeof rawVal === 'number' || isOutlier ? 700 : 500,
                                color: cIdx === 0 ? 'var(--text-main)' : 'inherit'
                              }}
                            >
                              {formatValue(rawVal)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
              <span>Method: <strong style={{ color: 'var(--primary)' }}>Phase 7 IQR Statistical Outlier Detection</strong></span>
              <span>IQR Multiplier: <strong style={{ color: 'var(--text-main)' }}>1.5x</strong></span>
              <span>Calculation: <strong style={{ color: 'var(--accent-emerald)' }}>100% Verifiable Deterministic</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Forecasting & Prediction View (Phase 12) */}
      {isForecast && (
        <div>
          {/* Forecast Summary Banner */}
          <div
            style={{
              background: isDark ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(56, 189, 248, 0.08))' : 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(56, 189, 248, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <TrendingUp size={22} style={{ color: 'var(--accent-violet)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-violet)' }}>
                  Time-Series Forecasting ({metadata.target || yKey} over {metadata.granularity || 'MONTH'})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-violet)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  Horizon: +{metadata.horizon || 3} {metadata.granularity || 'MONTH'}s
                </span>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: metadata.overallChangePercent >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', color: metadata.overallChangePercent >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', border: metadata.overallChangePercent >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)' }}>
                  Overall: {metadata.overallChangePercent >= 0 ? '+' : ''}{metadata.overallChangePercent}%
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Target Measure</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{formatLabel(metadata.target || yKey)}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Historical Periods</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{metadata.rowsAnalyzed || resultData.filter(r => r.Type === 'Historical').length}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Latest Historical</div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{formatValue(metadata.latestHistoricalValue)}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Final Forecast</div>
                <strong style={{ color: 'var(--accent-violet)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>{formatValue(metadata.finalForecastValue)}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Forecast Method</div>
                <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>Linear Regression</strong>
              </div>
            </div>

            {/* Validation / Backtest Metrics Sub-card */}
            {metadata.backtestMetrics ? (
              <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.85rem', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Validation / Backtest Metrics ({metadata.backtestMetrics.validationPeriods} Holdout Period{metadata.backtestMetrics.validationPeriods > 1 ? 's' : ''}):
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>MAE: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{metadata.backtestMetrics.mae}</strong></span>
                  <span>RMSE: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{metadata.backtestMetrics.rmse}</strong></span>
                  {metadata.backtestMetrics.mape !== null && (
                    <span>MAPE: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{metadata.backtestMetrics.mape}%</strong></span>
                  )}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Note: Backtest metrics describe historical model predictive accuracy over holdout validation periods. They do not describe future certainty.
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '0.85rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: 'var(--accent-amber)', fontSize: '0.78rem' }}>
                <AlertTriangle size={15} style={{ display: 'inline', marginRight: '0.35rem' }} />
                Insufficient historical periods for reliable backtesting.
              </div>
            )}
          </div>

          {/* Forecast Time-Series Chart */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} style={{ color: 'var(--accent-violet)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatLabel(metadata.target || yKey)} Forecast Chart
                </h4>
              </div>
              <span className="type-tag">Historical + {metadata.horizon || 3}-Period Forecast (95% CI)</span>
            </div>

            <div style={{ width: '100%', height: 340, marginTop: '0.5rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resultData} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="Period"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickLine={{ stroke: axisColor }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                    formatter={(val, name, item) => [
                      formatValue(val),
                      name === 'Lower Bound (95%)' || name === 'Upper Bound (95%)' ? name : formatLabel(item?.dataKey || name)
                    ]}
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={metadata.target || yKey}
                    name={`${formatLabel(metadata.target || yKey)} (${metadata.granularity || 'MONTH'})`}
                    stroke={isDark ? '#a855f7' : '#9333ea'}
                    strokeWidth={3}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const isFc = payload.Type === 'Forecast';
                      return (
                        <circle
                          key={props.index}
                          cx={cx}
                          cy={cy}
                          r={isFc ? 6 : 4}
                          fill={isFc ? '#f43f5e' : (isDark ? '#38bdf8' : '#0284c7')}
                          stroke={isDark ? '#0f172a' : '#ffffff'}
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Lower Bound (95%)"
                    name="Lower Bound (95%)"
                    stroke="#06b6d4"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Upper Bound (95%)"
                    name="Upper Bound (95%)"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Combined Results Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Forecast Results Table ({resultData.length} Periods)
                </h4>
              </div>
              <span className="type-badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-active)' }}>
                Historical & Forecast Breakdown
              </span>
            </div>

            <div className="table-wrapper">
              <table className="profile-table">
                <thead>
                  <tr>
                    {keys.map(key => (
                      <th key={key} style={{ textAlign: typeof firstRow[key] === 'number' ? 'right' : 'left' }}>{formatLabel(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultData.map((row, idx) => {
                    const isForecastRow = row.Type === 'Forecast';
                    return (
                      <tr key={idx} style={{ background: isForecastRow ? (isDark ? 'rgba(168, 85, 247, 0.08)' : 'rgba(168, 85, 247, 0.05)') : 'transparent' }}>
                        {keys.map((key, cIdx) => {
                          const rawVal = row[key];
                          const isTypeCol = key === 'Type';

                          if (isTypeCol) {
                            return (
                              <td key={cIdx}>
                                <span style={{ padding: '0.2rem 0.55rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, background: isForecastRow ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.15)', color: isForecastRow ? 'var(--accent-violet)' : 'var(--accent-emerald)' }}>
                                  {rawVal}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={cIdx}
                              style={{
                                textAlign: typeof rawVal === 'number' ? 'right' : 'left',
                                fontFamily: typeof rawVal === 'number' ? 'var(--font-mono)' : 'inherit',
                                fontWeight: typeof rawVal === 'number' || isForecastRow ? 700 : 500,
                                color: isForecastRow && cIdx === 2 ? 'var(--accent-violet)' : cIdx === 0 ? 'var(--text-main)' : 'inherit'
                              }}
                            >
                              {formatValue(rawVal)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
              <span>Method: <strong style={{ color: 'var(--primary)' }}>Linear Time-Index Regression</strong></span>
              <span>Confidence Bounds: <strong style={{ color: 'var(--text-main)' }}>95% Standard Prediction Band</strong></span>
              <span>Calculation: <strong style={{ color: 'var(--accent-emerald)' }}>100% Deterministic & Grounded</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Time Series Summary Banner (Phase 9) */}
      {isTimeSeries && (
        <div
          style={{
            background: isDark ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(56, 189, 248, 0.08))' : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(56, 189, 248, 0.05))',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <TrendingUp size={22} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)' }}>
                Time-Series Trend Analysis ({metadata.granularity || validation?.plan?.granularity || 'MONTH'})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '20px', background: trendBadgeStyle.bg, color: trendBadgeStyle.color, border: trendBadgeStyle.border, fontSize: '0.82rem', fontWeight: 700 }}>
              <TrendIcon size={16} />
              <span>Overall Trend: {trendDir}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
            <span>Date Column: <strong style={{ color: 'var(--text-main)' }}>{metadata.dateColumn || xKey}</strong></span>
            <span>Measure Analyzed: <strong style={{ color: 'var(--text-main)' }}>{metadata.measureColumn || yKey}</strong></span>
            <span>Chronological Periods: <strong style={{ color: 'var(--text-main)' }}>{resultData.length}</strong></span>
            <span>Granularity: <strong style={{ color: 'var(--primary)' }}>{metadata.granularity || validation?.plan?.granularity || 'MONTH'}</strong></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>Overall Trend</div>
              <strong style={{ color: trendBadgeStyle.color, fontSize: '0.95rem' }}>{trendDir}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>Trend Slope</div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                {metadata.slope !== undefined ? (metadata.slope >= 0 ? `+${formatValue(metadata.slope)}` : formatValue(metadata.slope)) : '—'}
              </strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>Relative Slope</div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                {metadata.relativeSlope !== undefined ? `${metadata.relativeSlope >= 0 ? '+' : ''}${metadata.relativeSlope}%` : '—'}
              </strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>R² (Fit Strength)</div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                {metadata.r2 !== undefined ? metadata.r2 : '—'}
              </strong>
            </div>
          </div>

          {metadata.missingValuesIgnored > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: 'var(--accent-amber)', fontSize: '0.8rem' }}>
              <AlertTriangle size={15} />
              <span>{metadata.missingValuesIgnored} {formatLabel(metadata.measureColumn || yKey)} values were missing. Trend calculations use available valid values.</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Scalar KPI Result Card */}
      {isScalar ? (
        <div
          style={{
            background: isDark ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08))' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.05))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            marginBottom: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Calculator size={22} style={{ color: 'var(--accent-emerald)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-emerald)' }}>
              {formatLabel(keys[0] || operation)}
            </span>
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
            {formatValue(Object.values(firstRow)[0])}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
            <span>Rows Analyzed: <strong style={{ color: 'var(--text-main)' }}>{metadata.rowsAnalyzed}</strong></span>
            <span>Missing Values Ignored: <strong style={{ color: 'var(--text-main)' }}>{metadata.missingValuesIgnored}</strong></span>
            <span>Operation: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{operation}</strong></span>
            <span>Engine: <strong style={{ color: 'var(--accent-emerald)' }}>100% Deterministic</strong></span>
          </div>
        </div>
      ) : null}

      {/* 4. Grouped / Tabular Results */}
      {!isScalar && !isCorrelation && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Analysis Result ({resultData.length} entries)
              </h4>
            </div>
            <span className="type-badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-active)' }}>
              Operation: {operation}
            </span>
          </div>

          <div className="table-wrapper">
            <table className="profile-table">
              <thead>
                <tr>
                  {keys.map(key => (
                    <th key={key}>{formatLabel(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultData.map((row, idx) => (
                  <tr key={idx}>
                    {keys.map((key, cIdx) => {
                      const rawVal = row[key];
                      const isGrowthCol = key === 'Growth (%)' || key === 'growth';

                      let growthColor = 'inherit';
                      if (isGrowthCol && typeof rawVal === 'number') {
                        growthColor = rawVal > 0 ? 'var(--accent-emerald)' : rawVal < 0 ? 'var(--accent-rose)' : 'inherit';
                      }

                      return (
                        <td
                          key={cIdx}
                          style={{
                            fontFamily: typeof rawVal === 'number' || isGrowthCol ? 'var(--font-mono)' : 'inherit',
                            fontWeight: typeof rawVal === 'number' || isGrowthCol ? 700 : 500,
                            color: isGrowthCol ? growthColor : cIdx === 0 ? 'var(--text-main)' : 'inherit'
                          }}
                        >
                          {isGrowthCol ? (typeof rawVal === 'number' ? `${rawVal > 0 ? '+' : ''}${rawVal}%` : String(rawVal)) : formatValue(rawVal)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
            <span>Rows Analyzed: <strong style={{ color: 'var(--text-main)' }}>{metadata.rowsAnalyzed}</strong></span>
            <span>Missing Values Ignored: <strong style={{ color: 'var(--text-main)' }}>{metadata.missingValuesIgnored}</strong></span>
            <span>Deterministic Calculation: <strong style={{ color: 'var(--accent-emerald)' }}>100% Verifiable</strong></span>
          </div>
        </div>
      )}

      {/* 5. Automatic Visualization Component (Line & Bar) */}
      {shouldChart && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isTimeSeries ? (
                <TrendingUp size={20} style={{ color: 'var(--accent-cyan)' }} />
              ) : (
                <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
              )}
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {isTimeSeries ? `Time Trend (${formatLabel(yKey)} over ${formatLabel(xKey)})` : `Distribution (${formatLabel(yKey)} by ${formatLabel(xKey)})`}
              </h4>
            </div>
            <span className="type-tag">
              {isTimeSeries ? 'Line Chart' : 'Bar Chart'}
            </span>
          </div>

          <div style={{ width: '100%', height: 340, marginTop: '0.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              {isTimeSeries ? (
                <LineChart data={resultData} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey={xKey}
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickLine={{ stroke: axisColor }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                    formatter={(val, name) => [formatValue(val), formatLabel(name)]}
                    labelFormatter={(label) => `${formatLabel(xKey)}: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey={yKey}
                    stroke={isDark ? '#38bdf8' : '#0284c7'}
                    strokeWidth={3}
                    dot={{ fill: isDark ? '#38bdf8' : '#0284c7', r: 5, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff' }}
                    activeDot={{ r: 7, fill: '#67e8f9' }}
                  />
                </LineChart>
              ) : (
                <BarChart data={resultData} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey={xKey}
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickLine={{ stroke: axisColor }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                    formatter={(val) => [formatValue(val), formatLabel(yKey)]}
                    labelFormatter={(label) => `${formatLabel(xKey)}: ${label}`}
                  />
                  <Bar
                    dataKey={yKey}
                    fill="url(#barGradient)"
                    radius={[6, 6, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

