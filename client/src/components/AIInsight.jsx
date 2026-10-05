import React from 'react';
import { Bot, Sparkles, ShieldCheck } from 'lucide-react';

export default function AIInsight({ explanation }) {
  if (!explanation) return null;

  return (
    <div
      style={{
        background: 'var(--primary-glow)',
        border: '1px solid var(--border-active)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        marginTop: '1.25rem',
        marginBottom: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
        <Bot size={18} style={{ color: 'var(--primary)' }} />
        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          AI Explanation & Grounded Finding
        </h4>
        <Sparkles size={15} style={{ color: 'var(--secondary)', marginLeft: 'auto' }} />
      </div>

      <blockquote
        style={{
          margin: 0,
          paddingLeft: '1rem',
          borderLeft: '3px solid var(--primary)',
          fontSize: '0.96rem',
          lineHeight: '1.6',
          color: 'var(--text-main)',
          fontStyle: 'normal'
        }}
      >
        {explanation}
      </blockquote>

      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
        <span>Grounded strictly in Phase 3 deterministic evidence • Zero calculation hallucination</span>
      </div>
    </div>
  );
}
