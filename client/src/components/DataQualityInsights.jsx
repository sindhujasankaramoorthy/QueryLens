import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Sparkles, Activity, Layers, HelpCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export default function DataQualityInsights({ rows, columns, insights: initialInsights, theme }) {
  const [insights, setInsights] = useState(initialInsights || []);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [activeTab, setActiveTab] = useState('quality'); // 'quality' | 'insights'
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
      console.error('Failed to fetch Phase 6 insights:', err);
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

  const currentDisplayList = activeTab === 'quality' ? qualityInsights : statisticalInsights;

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'high':
        return <span style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>CRITICAL</span>;
      case 'moderate':
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>MODERATE</span>;
      case 'low':
        return <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>LOW</span>;
      default:
        return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>INFO</span>;
    }
  };

  return (
    <div className="table-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles style={{ color: 'var(--secondary)' }} size={22} />
          <h3 className="section-title" style={{ margin: 0 }}>
            Data Quality & Statistical Insights (Phase 6)
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
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
          Data Quality ({qualityInsights.length})
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          style={{
            background: activeTab === 'insights' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'insights' ? 'var(--secondary)' : 'var(--text-muted)',
            border: activeTab === 'insights' ? '1px solid var(--border-active)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Statistical Patterns & Outliers ({statisticalInsights.length})
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

      {/* Insights Cards List */}
      {currentDisplayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={40} style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }} />
          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>No critical observations detected in this category.</p>
          <span style={{ fontSize: '0.82rem' }}>Dataset meets verifiable quality and statistical criteria.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {currentDisplayList.map((ins) => {
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
                      {getSeverityBadge(ins.severity)}
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
      )}
    </div>
  );
}
