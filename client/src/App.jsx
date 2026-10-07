import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import DatasetSummary from './components/DatasetSummary';
import QualityWarnings from './components/QualityWarnings';
import ColumnProfile from './components/ColumnProfile';
import QuestionPlanner from './components/QuestionPlanner';
import DataQualityInsights from './components/DataQualityInsights';
import ExecutiveSummaryModal from './components/ExecutiveSummaryModal';
import AuthModal from './components/AuthModal';
import LoginPage from './components/LoginPage';
import CursorGlow from './components/CursorGlow';
import { useAuth } from './context/AuthContext';
import { Sparkles, Sun, Moon, RefreshCw, BarChart3, Database, FileText, User, LogOut, LogIn, ShieldCheck } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, logout, getAuthHeaders } = useAuth();
  const [isGuestMode, setIsGuestMode] = useState(false);

  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Theme toggle state (light default, persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('psa01_theme') || 'light';
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
        headers: getAuthHeaders(),
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

  // If restoring auth session, render a smooth loading spinner
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f19', color: '#38bdf8' }}>
        <CursorGlow />
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Initializing QueryLens...</p>
        </div>
      </div>
    );
  }

  // If user is NOT logged in and has NOT chosen guest mode, render full-screen LoginPage
  if (!user && !isGuestMode) {
    return (
      <>
        <CursorGlow />
        <LoginPage 
          onContinueAsGuest={() => setIsGuestMode(true)} 
          theme={theme}
          toggleTheme={toggleTheme}
        />
      </>
    );
  }

  return (
    <div>
      <CursorGlow />
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-badge">
            <BarChart3 size={16} /> QueryLens
          </span>
          <div>
            <h1 className="brand-title">Schema-Agnostic AI Data Analyst</h1>
            <span className="brand-sub">Verifiable Numerical Analytics & Decision Support Engine</span>
          </div>
        </div>

        <div className="header-controls">
          <span className="phase-pill">
            <ShieldCheck size={13} /> Auth & JWT Ready
          </span>

          {/* User Auth Controls */}
          {user ? (
            <div className="user-profile-badge" style={styles.userBadge}>
              <div style={styles.avatar}>
                <User size={14} />
              </div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user.name}</span>
                <span style={styles.userEmail}>{user.email}</span>
              </div>
              <button
                className="btn-logout"
                onClick={() => {
                  logout();
                  setIsGuestMode(false);
                }}
                title="Log Out"
                style={styles.logoutBtn}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setIsAuthModalOpen(true)}
              style={styles.signInBtn}
            >
              <LogIn size={15} />
              <span>Sign In / Register</span>
            </button>
          )}

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
            <span>Decision Support & Report</span>
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

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setIsSummaryModalOpen(true)}>
                  <FileText size={15} />
                  Executive Summary & Report
                </button>
                <button className="btn btn-secondary" onClick={handleReset}>
                  <RefreshCw size={15} />
                  Upload New Dataset
                </button>
              </div>
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
            <QualityWarnings 
              warnings={profileData.warnings} 
              qualitySummary={profileData.qualitySummary}
            />

            {/* Phase 15 Executive Summary & Report Modal */}
            <ExecutiveSummaryModal 
              isOpen={isSummaryModalOpen} 
              onClose={() => setIsSummaryModalOpen(false)} 
              profileData={profileData} 
            />
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

const styles = {
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    backgroundColor: 'var(--card-bg, #1e293b)',
    border: '1px solid var(--border-color, #334155)',
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.85rem',
  },
  avatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.1,
  },
  userName: {
    fontWeight: '600',
    color: 'var(--text-main, #f8fafc)',
    fontSize: '0.85rem',
  },
  userEmail: {
    fontSize: '0.72rem',
    color: 'var(--text-muted, #94a3b8)',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '0.2rem',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
  },
  signInBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    padding: '0.45rem 0.9rem',
    borderRadius: '20px',
  },
};
