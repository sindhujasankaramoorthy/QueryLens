import React, { useState, useEffect } from 'react';
import { Sparkles, Send, AlertCircle, HelpCircle, CheckCircle, Code, MessageSquare, Terminal, HelpCircle as QuestionIcon } from 'lucide-react';
import ResultVisualization from './ResultVisualization';
import AIInsight from './AIInsight';

export default function QuestionPlanner({ columns, rows, theme }) {
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Store conversation history/context for multi-turn follow-ups
  const [context, setContext] = useState(null);

  useEffect(() => {
    if (columns && columns.length > 0) {
      fetch('/api/analysis/suggested-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.suggestions) {
            setSuggestions(data.suggestions);
          }
        })
        .catch(err => console.error('Failed to load suggestions:', err));
    }
  }, [columns]);

  const handleSubmit = async (qText) => {
    const query = qText || question;
    if (!query || query.trim() === '') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analysis/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          columns,
          rows,
          context: context // Pass previous context for conversational follow-ups
        })
      });

      const contentType = response.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        throw new Error(`Server returned non-JSON response (${response.status}). Ensure API server is running on port 5000.`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze question.');
      }

      setResult(data);

      // Update conversation context if validation succeeded
      if (data.validation?.status === 'validated' && data.execution) {
        setContext({
          previousQuestion: query,
          previousPlan: data.validation.plan,
          previousResult: data.execution.result
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (sug) => {
    setQuestion(sug);
    handleSubmit(sug);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'validated':
        return (
          <span className="type-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle size={13} style={{ marginRight: '4px' }} /> Plan Validated & Executed
          </span>
        );
      case 'clarification_required':
        return (
          <span className="type-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <HelpCircle size={13} style={{ marginRight: '4px' }} /> Clarification Required
          </span>
        );
      case 'cannot_answer':
        return (
          <span className="type-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-violet)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <AlertCircle size={13} style={{ marginRight: '4px' }} /> Cannot Answer
          </span>
        );
      default:
        return (
          <span className="type-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
            <AlertCircle size={13} style={{ marginRight: '4px' }} /> Rejected Plan
          </span>
        );
    }
  };

  return (
    <div className="table-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={22} style={{ color: 'var(--primary)' }} />
          <h3 className="section-title" style={{ margin: 0 }}>
            Natural Language Query Workbench
          </h3>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', background: 'var(--bg-app)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
          Deterministic Computation Engine
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
        Enter a question in plain English. PSA01 generates a validated execution contract and computes answers directly from raw data.
      </p>

      {/* Suggested Questions */}
      {suggestions.length > 0 && !context && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <QuestionIcon size={13} /> Suggested Questions for your dataset:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {suggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                className="type-tag"
                onClick={() => handleSuggestionClick(sug)}
                style={{
                  cursor: 'pointer',
                  padding: '0.4rem 0.8rem',
                  background: 'var(--bg-app)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.8rem'
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Conversation Context Banner */}
      {context && (
        <div style={{
          background: 'var(--primary-glow)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.7rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.84rem',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <MessageSquare size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <strong>Active Context:</strong> "{context.previousQuestion}" —
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
              Ask follow-ups like <em>"Which region contributed most?"</em> or <em>"Show that by month"</em>
            </span>
          </div>
        </div>
      )}

      {/* Query Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="query-input-wrapper">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={context ? "Ask a follow-up question (e.g. Which region contributed the most?)" : "e.g. Which region has the highest total sales?"}
          className="query-input-field"
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="btn btn-primary"
          style={{ opacity: isLoading || !question.trim() ? 0.6 : 1 }}
        >
          {isLoading ? (
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
          ) : (
            <Send size={16} />
          )}
          Calculate Answer
        </button>
      </form>

      {error && (
        <div className="error-banner" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Analysis Result View */}
      {result && (
        <div style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Analyzed Query</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)', marginTop: '0.1rem' }}>
                "{result.question}"
              </div>
            </div>
            {getStatusBadge(result.validation?.status)}
          </div>

          {result.validation?.status === 'validated' && result.execution && (
            <div>
              {/* Result Presentation & Chart Layer */}
              <ResultVisualization execution={result.execution} validation={result.validation} question={result.question} theme={theme} />

              {/* AI Natural Language Explanation */}
              <AIInsight explanation={result.explanation} />

              {/* Collapsible Validated Plan Contract */}
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <Code size={14} /> Inspect Machine JSON Analysis Plan Contract
                </summary>
                <pre style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-cyan)',
                  marginTop: '0.5rem',
                  overflowX: 'auto'
                }}>
                  {JSON.stringify(result.validation.plan, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {result.validation?.status === 'clarification_required' && (
            <div>
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--accent-amber)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                <strong>Clarification Required:</strong> {result.validation.clarificationQuestion}
              </div>
              <AIInsight explanation={result.explanation} />
            </div>
          )}

          {result.validation?.status === 'cannot_answer' && (
            <div>
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(139, 92, 246, 0.1)', borderLeft: '4px solid var(--secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                <strong>Question Unanswerable:</strong> {result.validation.reason}
              </div>
              <AIInsight explanation={result.explanation} />
            </div>
          )}

          {result.validation?.status === 'rejected' && (
            <div>
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(244, 63, 94, 0.1)', borderLeft: '4px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                <strong>Plan Rejected:</strong> {result.validation.reason}
              </div>
              <AIInsight explanation={result.explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
