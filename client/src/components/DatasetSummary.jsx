import React from 'react';
import { Database, Table, Layers, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';

export default function DatasetSummary({ dataset, duplicates, warningsCount }) {
  if (!dataset) return null;

  const formattedSize = (dataset.fileSize / 1024).toFixed(1) + ' KB';
  const isClean = warningsCount === 0 && duplicates.count === 0;

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-label">
          <span>Dataset File</span>
          <FileSpreadsheet size={15} style={{ color: 'var(--primary)' }} />
        </div>
        <div className="metric-value" style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dataset.fileName}>
          {dataset.fileName}
        </div>
        <div className="metric-sub">
          Format: <strong>{dataset.fileType.toUpperCase()}</strong> ({formattedSize})
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">
          <span>Total Rows</span>
          <Table size={15} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div className="metric-value">{dataset.rowCount.toLocaleString()}</div>
        <div className="metric-sub">Analyzed records</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">
          <span>Total Columns</span>
          <Layers size={15} style={{ color: 'var(--secondary)' }} />
        </div>
        <div className="metric-value">{dataset.columnCount}</div>
        <div className="metric-sub">Attributes detected</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">
          <span>Duplicate Rows</span>
          <AlertTriangle size={15} style={{ color: duplicates.count > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} />
        </div>
        <div className="metric-value" style={{ color: duplicates.count > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
          {duplicates.count}
        </div>
        <div className="metric-sub">
          {(duplicates.percentage * 100).toFixed(1)}% of total rows
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">
          <span>Quality Status</span>
          {isClean ? (
            <CheckCircle size={15} style={{ color: 'var(--accent-emerald)' }} />
          ) : (
            <AlertTriangle size={15} style={{ color: 'var(--accent-amber)' }} />
          )}
        </div>
        <div className="metric-value" style={{ fontSize: '1.15rem', color: isClean ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
          {isClean ? 'Clean Data' : `${warningsCount} Warning(s)`}
        </div>
        <div className="metric-sub">
          {isClean ? 'No critical data issues' : 'Inspect Quality Audit below'}
        </div>
      </div>
    </div>
  );
}
