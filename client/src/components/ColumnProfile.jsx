import React from 'react';
import { Table, Hash, AlignLeft, Calendar, CheckSquare, HelpCircle } from 'lucide-react';

export default function ColumnProfile({ columns }) {
  if (!columns || columns.length === 0) return null;

  return (
    <div className="table-card">
      <div className="table-header-box">
        <h3 className="section-title" style={{ margin: 0 }}>
          <Table size={18} style={{ color: 'var(--primary)' }} />
          Column Schema & Statistical Profile ({columns.length} columns)
        </h3>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Auto-detected datatypes & empirical distributions
        </span>
      </div>
      <div className="table-wrapper">
        <table className="profile-table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Inferred Type</th>
              <th>Missing Values</th>
              <th>Unique Values</th>
              <th>Numerical Statistics / Top Categories</th>
              <th>Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.name}>
                <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {col.name}
                </td>
                <td>
                  <span className={`type-badge type-${col.type}`}>
                    {col.type}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>
                    {col.missingCount} row(s)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: col.missingPercentage > 0.1 ? 'var(--accent-amber)' : 'var(--text-dim)' }}>
                    {(col.missingPercentage * 100).toFixed(1)}% missing
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {col.uniqueCount.toLocaleString()}
                </td>
                <td>
                  {col.statistics ? (
                    <div className="stats-list" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div>Mean: <strong style={{ color: 'var(--text-main)' }}>{col.statistics.mean}</strong></div>
                      <div>Median: <strong style={{ color: 'var(--text-main)' }}>{col.statistics.median}</strong></div>
                      <div>Range: <strong style={{ color: 'var(--text-main)' }}>{col.statistics.min} to {col.statistics.max}</strong></div>
                      <div>Std Dev: <strong style={{ color: 'var(--text-main)' }}>{col.statistics.std}</strong></div>
                    </div>
                  ) : col.categorical && col.categorical.topValues.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {col.categorical.topValues.map((tv, idx) => (
                        <div key={idx} className="type-tag" style={{ fontSize: '0.75rem' }}>
                          {tv.value}: <strong style={{ color: 'var(--primary)' }}>{tv.count}</strong> ({(tv.frequency * 100).toFixed(1)}%)
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>N/A</span>
                  )}
                </td>
                <td>
                  {col.sampleValues && col.sampleValues.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {col.sampleValues.slice(0, 3).map((val, idx) => (
                        <span key={idx} className="type-tag" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                          {String(val)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
