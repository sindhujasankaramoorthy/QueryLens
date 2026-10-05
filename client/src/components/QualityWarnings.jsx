import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

export default function QualityWarnings({ warnings, qualitySummary }) {
  const overallStatus = qualitySummary?.overallStatus || (warnings && warnings.length > 0 ? 'WARNING' : 'CLEAN');

  if (!warnings || warnings.length === 0) {
    if (overallStatus === 'WARNING') {
      return (
        <div className="warnings-container">
          <h3 className="section-title">
            <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
            Data Quality Status: WARNING
          </h3>
          <div className="warning-item warning" style={{ borderLeftColor: 'var(--accent-amber)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--accent-amber)' }}>Data Quality Status: WARNING</strong> — Minor data-quality issues detected. Analysis can proceed with appropriate handling.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="warnings-container">
        <h3 className="section-title">
          <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
          Data Quality Status: CLEAN
        </h3>
        <div className="warning-item info" style={{ borderLeftColor: 'var(--accent-emerald)' }}>
          <Info size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--accent-emerald)' }}>Clean Dataset:</strong> Dataset is clean and suitable for analytical decision support.
          </div>
        </div>
      </div>
    );
  }

  const getIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={18} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />;
      default:
        return <Info size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />;
    }
  };

  return (
    <div className="warnings-container">
      <h3 className="section-title">
        <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
        Data Quality Warnings ({warnings.length})
      </h3>
      {warnings.map((warn) => (
        <div key={warn.id} className={`warning-item ${warn.severity}`}>
          {getIcon(warn.severity)}
          <div>
            <span>{warn.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
