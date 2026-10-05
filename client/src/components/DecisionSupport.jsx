import React from 'react';
import { ShieldCheck, Compass, CheckCircle2, AlertTriangle, FileText, Activity, Info, Award } from 'lucide-react';

export default function DecisionSupport({ decisionSupport }) {
  if (!decisionSupport) return null;

  const { finding, evidence, recommendation, disclaimers, traceability, analysisType } = decisionSupport;

  const getTypeLabel = (type) => {
    switch (type) {
      case 'trend': return 'Time-Series Trend Decision Support';
      case 'correlation': return 'Correlation & Association Decision Support';
      case 'anomaly': return 'Statistical Outliers Decision Support';
      case 'forecast': return 'Forecasting & Projection Decision Support';
      case 'root_cause': return 'Root-Cause & Contribution Decision Support';
      default: return 'Evidence-Based Analytical Decision Support';
    }
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '1.5rem',
      marginTop: '1.5rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Compass size={22} style={{ color: 'var(--primary)' }} />
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {getTypeLabel(analysisType)}
          </h4>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.65rem', borderRadius: '9999px' }}>
          Verified Grounded Results
        </span>
      </div>

      {/* Primary Analytical Finding */}
      <div style={{ background: 'var(--bg-app)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 800, marginBottom: '0.3rem' }}>
          Analytical Finding
        </div>
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.5' }}>
          {finding}
        </p>
      </div>

      {/* Grid: Supporting Evidence & Evidence-Based Recommendation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Supporting Evidence List */}
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <Activity size={16} /> Supporting Evidence (Deterministic Outputs)
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
            {evidence && evidence.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>{item}</strong>
              </li>
            ))}
          </ul>
        </div>

        {/* Actionable Recommendation */}
        <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-sm)', padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <Award size={16} /> Actionable Evidence-Based Recommendation
          </div>
          <h5 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {recommendation?.title}
          </h5>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.55' }}>
            {recommendation?.action}
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', borderTop: '1px dashed rgba(99, 102, 241, 0.2)', paddingTop: '0.5rem', fontStyle: 'italic' }}>
            Note: {recommendation?.evidenceNote}
          </div>
        </div>

      </div>

      {/* Disclaimers Panel */}
      {disclaimers && disclaimers.length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)', fontWeight: 800, marginBottom: '0.35rem' }}>
            <AlertTriangle size={15} /> Statistical & Methodological Boundaries
          </div>
          {disclaimers.map((disc, idx) => (
            <p key={idx} style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', lineHeight: '1.45' }}>
              • {disc}
            </p>
          ))}
        </div>
      )}

      {/* Engine Traceability Footer */}
      {traceability && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span><strong>Traceability:</strong> {traceability.engine} → {traceability.calculationSource}</span>
          </div>
          <span><strong>AI Function:</strong> {traceability.aiRole}</span>
        </div>
      )}
    </div>
  );
}
