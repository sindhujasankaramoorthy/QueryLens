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

  const isCorrelation = operation === 'correlation' || firstRow.correlation !== undefined;
  const isTimeSeries = operation === 'time_series' || operation === 'time_group' || Boolean(metadata?.dateColumn) || Boolean(validation?.plan?.granularity) || Boolean(validation?.plan?.timeUnit);

  // Auto detect xKey and yKey for non-correlation charts
  let xKey = metadata?.dateColumn || validation?.plan?.date_column || validation?.plan?.column || validation?.plan?.groupBy;
  if (!xKey || !(xKey in firstRow)) {
    xKey = keys.find(k => typeof firstRow[k] !== 'number') || keys[0];
  }

  let yKey = null;
  if (metadata?.measureColumn || validation?.plan?.measure) {
    const targetM = metadata?.measureColumn || validation?.plan?.measure;
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

  const isScalar = !isCorrelation && !isTimeSeries && resultData.length === 1 && (keys.length === 1 || ['count', 'sum', 'average', 'median', 'min', 'max', 'describe'].includes(operation));
  const shouldChart = !isScalar && !isCorrelation && resultData.length > 1 && Boolean(yKey);

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
      {/* 1. Correlation Analysis Result Card */}
      {isCorrelation ? (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <Activity size={22} style={{ color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-violet)' }}>
                Pearson Correlation Coefficient (r)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                {firstRow.correlation >= 0 ? `+${firstRow.correlation}` : firstRow.correlation}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {firstRow.columnX} vs {firstRow.columnY}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <span>Paired Observations Used: <strong style={{ color: 'var(--text-main)' }}>{firstRow.observations || metadata.rowsAnalyzed}</strong></span>
              <span>Missing Rows Excluded: <strong style={{ color: 'var(--text-main)' }}>{metadata.missingValuesIgnored}</strong></span>
              <span>Method: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{firstRow.method || 'pearson'}</strong></span>
              <span>Engine: <strong style={{ color: 'var(--accent-emerald)' }}>Pure JS Deterministic</strong></span>
            </div>
          </div>

          {/* Scatter Plot Chart */}
          {metadata.scatterPoints && metadata.scatterPoints.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScatterIcon size={20} style={{ color: 'var(--secondary)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Scatter Plot ({firstRow.columnX} vs {firstRow.columnY})
                  </h4>
                </div>
                <span className="type-tag">Scatter Plot ({metadata.scatterPoints.length} points)</span>
              </div>

              <div style={{ width: '100%', height: 320, marginTop: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="x"
                      name={firstRow.columnX}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(firstRow.columnX), position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="y"
                      name={firstRow.columnY}
                      type="number"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      tickLine={{ stroke: axisColor }}
                      label={{ value: formatLabel(firstRow.columnY), angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipTextColor }}
                      formatter={(val, name) => [formatValue(val), name === 'x' ? formatLabel(firstRow.columnX) : formatLabel(firstRow.columnY)]}
                    />
                    <Scatter name="Observations" data={metadata.scatterPoints} fill="var(--primary)" opacity={0.85} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : null}

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

