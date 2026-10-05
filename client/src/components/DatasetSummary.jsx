import React from 'react';
import { Database, Table, Layers, AlertTriangle, CheckCircle, ShieldAlert, Activity, FileSpreadsheet, XCircle } from 'lucide-react';

export default function DatasetSummary({ dataset, duplicates, warningsCount, qualitySummary }) {
  if (!dataset) return null;

  const formattedSize = (dataset.fileSize / 1024).toFixed(1) + ' KB';
  const qs = qualitySummary || dataset.qualitySummary;
  const overallStatus = qs?.overallStatus || (warningsCount === 0 && (!duplicates || duplicates.count === 0) ? 'CLEAN' : 'WARNING');
  const statusMsg = qs?.statusMessage || (overallStatus === 'CLEAN' ? 'No major data-quality issues detected. The dataset is suitable for analysis.' : 'Minor data-quality issues or statistical anomalies detected.');

  const metrics = qs?.metrics || {
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    totalMissing: 0,
    totalDuplicates: duplicates?.count || 0,
    duplicatePercentage: ((duplicates?.percentage || 0) * 100).toFixed(1),
    totalInvalid: 0,
    totalOutliers: 0
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CLEAN': return 'var(--accent-emerald)';
      case 'CRITICAL': return 'var(--accent-rose)';
      default: return 'var(--accent-amber)';
    }
  };

  const statusColor = getStatusColor(overallStatus);

  return (
    <div className="metrics-grid">
      {/* File Info */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Dataset File</span>
          <FileSpreadsheet size={15} style={{ color: 'var(--primary)' }} />
        </div>
        <div className="metric-value" style={{ fontSize: '1.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dataset.fileName}>
          {dataset.fileName}
        </div>
        <div className="metric-sub">
          Format: <strong>{dataset.fileType.toUpperCase()}</strong> ({formattedSize})
        </div>
      </div>

      {/* Rows */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Total Rows</span>
          <Table size={15} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div className="metric-value">{dataset.rowCount.toLocaleString()}</div>
        <div className="metric-sub">Analyzed records</div>
      </div>

      {/* Columns */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Total Columns</span>
          <Layers size={15} style={{ color: 'var(--secondary)' }} />
        </div>
        <div className="metric-value">{dataset.columnCount}</div>
        <div className="metric-sub">Attributes detected</div>
      </div>

      {/* Missing Values */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Missing Values</span>
          <Activity size={15} style={{ color: metrics.totalMissing > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} />
        </div>
        <div className="metric-value" style={{ color: metrics.totalMissing > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
          {metrics.totalMissing.toLocaleString()}
        </div>
        <div className="metric-sub">
          {metrics.missingPercentage !== undefined ? `${metrics.missingPercentage}% of cells` : 'Empty entries'}
        </div>
      </div>

      {/* Duplicate Rows */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Duplicate Rows</span>
          <AlertTriangle size={15} style={{ color: metrics.totalDuplicates > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} />
        </div>
        <div className="metric-value" style={{ color: metrics.totalDuplicates > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
          {metrics.totalDuplicates}
        </div>
        <div className="metric-sub">
          {metrics.duplicatePercentage}% duplicate records
        </div>
      </div>

      {/* Invalid Values */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Invalid Values</span>
          <XCircle size={15} style={{ color: metrics.totalInvalid > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
        </div>
        <div className="metric-value" style={{ color: metrics.totalInvalid > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
          {metrics.totalInvalid}
        </div>
        <div className="metric-sub">Negative metrics & corrupted dates</div>
      </div>

      {/* Outliers */}
      <div className="metric-card">
        <div className="metric-label">
          <span>Outliers (IQR)</span>
          <Activity size={15} style={{ color: metrics.totalOutliers > 0 ? 'var(--accent-cyan)' : 'var(--accent-emerald)' }} />
        </div>
        <div className="metric-value" style={{ color: metrics.totalOutliers > 0 ? 'var(--accent-cyan)' : 'var(--accent-emerald)' }}>
          {metrics.totalOutliers}
        </div>
        <div className="metric-sub">Statistically unusual values</div>
      </div>

      {/* Overall Data Quality Status */}
      <div className="metric-card" style={{ border: `1px solid ${statusColor}` }}>
        <div className="metric-label">
          <span>Overall Quality Status</span>
          {overallStatus === 'CLEAN' ? (
            <CheckCircle size={15} style={{ color: statusColor }} />
          ) : overallStatus === 'CRITICAL' ? (
            <ShieldAlert size={15} style={{ color: statusColor }} />
          ) : (
            <AlertTriangle size={15} style={{ color: statusColor }} />
          )}
        </div>
        <div className="metric-value" style={{ fontSize: '1.2rem', color: statusColor, fontWeight: 800 }}>
          {overallStatus}
        </div>
        <div className="metric-sub" style={{ fontSize: '0.75rem', lineHeight: '1.2' }} title={statusMsg}>
          {statusMsg}
        </div>
      </div>
    </div>
  );
}
