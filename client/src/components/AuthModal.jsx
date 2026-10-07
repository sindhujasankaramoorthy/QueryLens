import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <span style={styles.icon}>{isRegister ? '👤' : '🔐'}</span>
            <h3 style={styles.title}>
              {isRegister ? 'Create QueryLens Account' : 'Sign In to QueryLens'}
            </h3>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={styles.tabs}>
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(isRegister ? {} : styles.activeTab),
            }}
            onClick={() => {
              setIsRegister(false);
              setErrorMessage(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(isRegister ? styles.activeTab : {}),
            }}
            onClick={() => {
              setIsRegister(true);
              setErrorMessage(null);
            }}
          >
            Register
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div style={styles.errorAlert}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <div style={styles.field}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Sindhuja Sankar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isRegister}
                style={styles.input}
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={styles.input}
            />
            <span style={styles.hint}>Must be at least 6 characters</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              ...(loading ? styles.disabledBtn : {}),
            }}
          >
            {loading ? (
              <span>Processing...</span>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer info */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              style={styles.toggleLink}
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMessage(null);
              }}
            >
              {isRegister ? 'Sign In here' : 'Register now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    padding: '1.75rem',
    color: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  icon: {
    fontSize: '1.4rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#f8fafc',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
  },
  tabs: {
    display: 'flex',
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '4px',
    marginBottom: '1.25rem',
  },
  tab: {
    flex: 1,
    padding: '0.5rem',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontWeight: '500',
    fontSize: '0.9rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontWeight: '600',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#fca5a5',
    padding: '0.75rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#f8fafc',
    fontSize: '0.95rem',
    outline: 'none',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background-color 0.2s',
  },
  disabledBtn: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: '1.25rem',
    textAlign: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '1rem',
  },
  footerText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  toggleLink: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
};
