import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Sparkles, Activity, Table, CheckCircle2, ShieldAlert, XCircle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export default function DataQualityInsights({ rows, columns, insights: initialInsights, qualitySummary, theme }) {
  const [insights, setInsights] = useState(initialInsights || []);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'quality' | 'statistical'
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if ((!initialInsights || initialInsights.length === 0) && rows && rows.length > 0) {
      fetchInsights();
    } else {
      setInsights(initialInsights || []);
    }
  }, [rows, columns, initialInsights]);

  const fetchInsights = async () => {
    try {
      const response = await fetch('/api/analysis/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, columns: (columns || []).map(c => c.name || c) })
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.insights)) {
        setInsights(data.insights);
        if (data.explanation) {
          setAiExplanation(data.explanation);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Phase 8 insights:', err);
    }
  };

  const generateAiSynthesis = async () => {
    setIsLoadingAi(true);
    try {
      const response = await fetch('/api/analysis/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, columns: (columns || []).map(c => c.name || c) })
      });
      const data = await response.json();
      if (data.success && data.explanation) {
        setAiExplanation(data.explanation);
      }
    } catch (err) {
      console.error('AI Synthesis error:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const qualityTypes = new Set(['missing_values', 'duplicates', 'quality_warning']);
  const qualityInsights = insights.filter(i => qualityTypes.has(i.insightType));
  const statisticalInsights = insights.filter(i => !qualityTypes.has(i.insightType));

  const qs = qualitySummary;
  const overallStatus = qs?.overallStatus || (insights.length === 0 ? 'CLEAN' : 'WARNING');
  const statusMessage = qs?.statusMessage || (overallStatus === 'CLEAN' ? 'No major data-quality issues detected. The dataset is suitable for analysis.' : 'Minor data-quality issues or statistical anomalies detected.');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Clean':
      case 'CLEAN':
        return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>CLEAN</span>;
      case 'Critical':
      case 'CRITICAL':
        return <span style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>CRITICAL</span>;
      default:
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>WARNING</span>;
    }
  };

  const columnTable = (columns || []).map(c => {
    const name = c.name || c;
    const type = c.type || 'text';
    const dataType = c.dataType || type;
    const semanticType = c.semanticType || (type === 'integer' || type === 'float' ? 'measure' : 'categorical');
    const missingCount = c.missingCount || 0;
    const uniqueCount = c.uniqueCount || 0;
    const outlierCount = c.outlierCount || 0;
    const invalidCount = c.invalidCount || 0;
    const status = c.status || (invalidCount > 0 || missingCount / Math.max(1, rows?.length || 1) >= 0.15 ? 'Critical' : (outlierCount > 0 || missingCount > 0 ? 'Warning' : 'Clean'));

    let issueText = '—';
    if (semanticType === 'identifier') {
      issueText = 'No stats required (Identifier)';
    } else if (c.issues && c.issues.length > 0 && c.issues[0] !== 'Clean') {
      issueText = c.issues.join('; ');
    } else if (outlierCount > 0) {
      issueText = `${outlierCount} IQR outlier(s)`;
    } else if (missingCount > 0) {
      issueText = `${missingCount} missing value(s)`;
    }

    return { name, type, dataType, semanticType, missingCount, uniqueCount, outlierCount, invalidCount, status, issueText };
  });

  return (
    <div className="table-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles style={{ color: 'var(--secondary)' }} size={22} />
          <h3 className="section-title" style={{ margin: 0 }}>
            Phase 8 Data Quality & Validation Audit
          </h3>
        </div>
        <button
          onClick={generateAiSynthesis}
          disabled={isLoadingAi}
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
        >
          <Activity size={14} />
          {isLoadingAi ? 'Synthesizing...' : 'Synthesize AI Insights'}
        </button>
      </div>

      {/* Overall Data Quality Status Banner */}
      <div style={{
        background: overallStatus === 'CLEAN' ? 'rgba(16, 185, 129, 0.08)' : overallStatus === 'CRITICAL' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: overallStatus === 'CLEAN' ? '1px solid rgba(16, 185, 129, 0.3)' : overallStatus === 'CRITICAL' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {overallStatus === 'CLEAN' ? (
          <CheckCircle2 size={28} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
        ) : overallStatus === 'CRITICAL' ? (
          <ShieldAlert size={28} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={28} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
            <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Overall Dataset Suitability:</strong>
            {getStatusBadge(overallStatus)}
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            {statusMessage}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('table')}
          style={{
            background: activeTab === 'table' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'table' ? 'var(--primary)' : 'var(--text-muted)',
            border: activeTab === 'table' ? '1px solid var(--border-active)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Table size={14} /> Detailed Column Audit ({columnTable.length})
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          style={{
            background: activeTab === 'quality' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'quality' ? 'var(--primary)' : 'var(--text-muted)',
            border: activeTab === 'quality' ? '1px solid var(--border-active)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Quality Issues ({qualityInsights.length})
        </button>
        <button
          onClick={() => setActiveTab('statistical')}
          style={{
            background: activeTab === 'statistical' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'statistical' ? 'var(--secondary)' : 'var(--text-muted)',
            border: activeTab === 'statistical' ? '1px solid var(--border-active)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Statistical Anomalies ({statisticalInsights.length})
        </button>
      </div>

      {/* AI Synthesis Summary Block */}
      {aiExplanation && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 800, marginBottom: '0.4rem', fontSize: '0.88rem' }}>
            <Sparkles size={16} /> Grounded AI Evidence Synthesis
          </div>
          <p style={{ fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--text-main)', whiteSpace: 'pre-line', margin: 0 }}>
            {aiExplanation}
          </p>
        </div>
      )}

      {/* TAB CONTENT 1: Column Audit Table */}
      {activeTab === 'table' && (
        <div className="table-wrapper">
          <table className="profile-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Storage & Semantic Type</th>
                <th style={{ textAlign: 'right' }}>Missing</th>
                <th style={{ textAlign: 'right' }}>Unique</th>
                <th>Outliers / Findings</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {columnTable.map(row => (
                <tr key={row.name}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {row.name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span className={`type-badge type-${row.type}`}>{row.type}</span>
                      <span className={`type-badge type-${row.semanticType}`} style={{ fontSize: '0.68rem', textTransform: 'uppercase', opacity: 0.85 }}>{row.semanticType}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: row.missingCount > 0 ? 700 : 400, color: row.missingCount > 0 ? 'var(--accent-amber)' : 'var(--text-main)' }}>
                    {row.missingCount}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {row.uniqueCount.toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {row.issueText}
                  </td>
                  <td>
                    {getStatusBadge(row.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT 2 & 3: Insights Cards List */}
      {activeTab !== 'table' && (
        (activeTab === 'quality' ? qualityInsights : statisticalInsights).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={40} style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }} />
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>No critical observations detected in this category.</p>
            <span style={{ fontSize: '0.82rem' }}>Dataset meets verifiable data quality criteria.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {(activeTab === 'quality' ? qualityInsights : statisticalInsights).map((ins) => {
              const isExpanded = expandedId === ins.id;
              return (
                <div
                  key={ins.id}
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleExpand(ins.id)}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        {getStatusBadge(ins.severity)}
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {ins.title}
                        </span>
                        {ins.column && (
                          <span className="type-tag" style={{ fontFamily: 'var(--font-mono)' }}>
                            {ins.column}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                        {ins.observation}
                      </p>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {/* Structured Evidence Panel */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.83rem' }}>
                      <div style={{ marginBottom: '0.5rem', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                        <HelpCircle size={14} /> Why it matters: <span style={{ fontWeight: 400, color: 'var(--text-main)' }}>{ins.whyItMatters}</span>
                      </div>
                      <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                        <strong>Deterministic Evidence:</strong>
                        <pre style={{ margin: '0.4rem 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          {JSON.stringify(ins.evidence, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
