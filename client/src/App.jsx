import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import DatasetSummary from './components/DatasetSummary';
import QualityWarnings from './components/QualityWarnings';
import ColumnProfile from './components/ColumnProfile';
import QuestionPlanner from './components/QuestionPlanner';
import DataQualityInsights from './components/DataQualityInsights';
import { Sparkles, Sun, Moon, RefreshCw, BarChart3, Database, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Theme toggle state (dark default, persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('psa01_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('psa01_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/datasets/profile', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to profile uploaded dataset.');
      }

      setProfileData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setProfileData(null);
    setError(null);
  };

  return (
    <div>
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-badge">
            <BarChart3 size={16} /> PSA01
          </span>
          <div>
            <h1 className="brand-title">Schema-Agnostic AI Data Analyst</h1>
            <span className="brand-sub">Verifiable Numerical Analytics & Quality Engine</span>
          </div>
        </div>

        <div className="header-controls">
          <span className="phase-pill">
            <Sparkles size={13} /> Phase 8: Data Quality & Validation
          </span>

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} style={{ color: '#f59e0b' }} />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={15} style={{ color: '#6366f1' }} />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="container">
        {/* Visual Workflow Stepper Bar */}
        <div className="stepper-bar">
          <div className={`step-item ${!profileData ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span>Upload Dataset</span>
          </div>
          <div className="step-divider" />
          <div className={`step-item ${profileData ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span>Schema & Profile</span>
          </div>
          <div className="step-divider" />
          <div className={`step-item ${profileData ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span>Natural Language Query</span>
          </div>
          <div className="step-divider" />
          <div className={`step-item ${profileData ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span>Data Quality Audit</span>
          </div>
        </div>

        {!profileData ? (
          <FileUpload 
            onFileUpload={handleFileUpload} 
            isLoading={isLoading} 
            error={error} 
          />
        ) : (
          <div>
            {/* Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={22} style={{ color: 'var(--primary)' }} />
                  Dataset Workbench
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                  Schema detected automatically. Ask questions to generate 100% verifiable calculations.
                </p>
              </div>

              <button className="btn btn-secondary" onClick={handleReset}>
                <RefreshCw size={15} />
                Upload New Dataset
              </button>
            </div>

            {/* 1. Dataset Overview & Metrics Grid */}
            <DatasetSummary 
              dataset={profileData.dataset} 
              duplicates={profileData.duplicates} 
              warningsCount={profileData.warnings ? profileData.warnings.length : 0}
              qualitySummary={profileData.qualitySummary}
            />

            {/* 2. Natural Language Analysis Workbench */}
            <QuestionPlanner 
              columns={profileData.columns} 
              rows={profileData.rows} 
              theme={theme}
            />

            {/* 3. Phase 8 Data Quality & Validation Audit */}
            <DataQualityInsights 
              rows={profileData.rows} 
              columns={profileData.columns} 
              insights={profileData.insights} 
              qualitySummary={profileData.qualitySummary}
              theme={theme}
            />

            {/* 4. Column Schema & Detailed Profile Table */}
            <ColumnProfile columns={profileData.columns} />

            {/* 5. Dataset Quality Warnings */}
            <QualityWarnings warnings={profileData.warnings} />
          </div>
        )}
      </main>
    </div>
  );
}
