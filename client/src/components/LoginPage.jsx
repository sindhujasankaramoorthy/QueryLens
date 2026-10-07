import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Activity, 
  Cpu, 
  Sun, 
  Moon,
  CheckCircle2,
  LineChart,
  Check
} from 'lucide-react';

export default function LoginPage({ onContinueAsGuest, theme, toggleTheme }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your full name.');
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setError(null);
    setLoading(true);
    setEmail('demo@querylens.ai');
    setPassword('password123');

    try {
      await login('demo@querylens.ai', 'password123');
    } catch (err) {
      try {
        await register('Demo Analyst', 'demo@querylens.ai', 'password123');
      } catch (regErr) {
        setError(regErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Dynamic Floating Ambient Glow Orbs */}
      <div className="ambient-orb orb-primary" />
      <div className="ambient-orb orb-secondary" />

      {/* Top Header matching Main Application */}
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
            <ShieldCheck size={13} /> Auth & JWT Powered
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

      {/* Main Hero Container */}
      <main className="login-hero-container">
        {/* Left Side: Product Showcase & Features */}
        <div className="login-showcase-panel">
          <div className="showcase-badge animated-badge">
            <span className="live-pulse-dot" />
            <Sparkles size={14} /> AI-Powered Analytical Intelligence
          </div>

          <h2 className="showcase-heading">
            Ask questions in plain English — get <span className="highlight-text">verifiable, deterministic</span> answers.
          </h2>

          <p className="showcase-description">
            QueryLens converts natural-language data questions into validated execution plans, computes results with zero math hallucinations, and generates grounded executive reports.
          </p>

          {/* Animated Interactive Live Engine Widget */}
          <div className="floating-preview-card">
            <div className="preview-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LineChart size={16} style={{ color: 'var(--primary)' }} />
                <span className="preview-card-title">Live Calculation Stream</span>
              </div>
              <span className="preview-status-pill">
                <Check size={12} /> Deterministic Plan Validated
              </span>
            </div>

            {/* SVG Wave Graphic Animation */}
            <div className="svg-wave-container">
              <svg className="wave-svg" viewBox="0 0 400 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="var(--accent-cyan)" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,35 Q40,15 80,30 T160,25 T240,40 T320,15 T400,30"
                  fill="none"
                  stroke="url(#waveGradient)"
                  strokeWidth="3"
                  className="animated-wave-path"
                />
              </svg>
            </div>

            <div className="preview-metrics-row">
              <div className="metric-pill">
                <span className="metric-label">Execution Time</span>
                <span className="metric-val">12ms</span>
              </div>
              <div className="metric-pill">
                <span className="metric-label">Math Accuracy</span>
                <span className="metric-val green">100% Verifiable</span>
              </div>
              <div className="metric-pill">
                <span className="metric-label">Hallucinations</span>
                <span className="metric-val violet">0%</span>
              </div>
            </div>
          </div>

          {/* Feature Grid */}
          <div className="showcase-features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper cyan">
                <Cpu size={20} />
              </div>
              <div>
                <h4 className="feature-title">SVG Analytical Planning</h4>
                <p className="feature-desc">AI plans structured operations separate from deterministic calculations.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper emerald">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="feature-title">0% AI Calculation Hallucinations</h4>
                <p className="feature-desc">Every number, correlation coefficient, and forecast is computed deterministically.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper amber">
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 className="feature-title">Time-Series & Forecasting</h4>
                <p className="feature-desc">Automatic linear regression, seasonal trend analysis, and prediction intervals.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper violet">
                <Activity size={20} />
              </div>
              <div>
                <h4 className="feature-title">Anomaly & Quality Audit</h4>
                <p className="feature-desc">IQR outlier detection, duplicate row auditing, and categorical consistency checks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Dynamic Auth Card */}
        <div className="login-card-panel">
          <div className="auth-card animated-card">
            <div className="auth-header">
              <h3 className="auth-title">
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </h3>
              <p className="auth-subtitle">
                {isRegister
                  ? 'Sign up to start analyzing your datasets with QueryLens'
                  : 'Enter your credentials to access your analytics workbench'}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${!isRegister ? 'active' : ''}`}
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${isRegister ? 'active' : ''}`}
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
              >
                Register
              </button>
            </div>

            {/* Error Message Banner */}
            {error && (
              <div className="auth-error-banner">
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              {isRegister && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-input-wrapper">
                    <User size={18} className="form-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Sindhuja Sankar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={isRegister}
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-input-wrapper">
                  <Mail size={18} className="form-icon" />
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-input-wrapper">
                  <Lock size={18} className="form-icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary auth-submit-btn animated-btn"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="auth-divider">
              <div className="divider-line" />
              <span className="divider-label">or</span>
              <div className="divider-line" />
            </div>

            {/* Quick Demo & Guest Buttons */}
            <div className="auth-actions">
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                className="btn-demo-login animated-btn"
              >
                <Zap size={16} style={{ color: '#f59e0b' }} />
                <span>⚡ Quick 1-Click Demo Login</span>
              </button>

              {onContinueAsGuest && (
                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  className="btn-guest-login"
                >
                  <span>Continue as Guest →</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
