const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getIsConnected } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'querylens_secret_key_2026';

// Generate JWT Token
const generateToken = (userId, extraPayload = {}) => {
  return jwt.sign({ id: userId, ...extraPayload }, JWT_SECRET, {
    expiresIn: '7d',
  });
};

// Protect routes middleware
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      if (getIsConnected()) {
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return res.status(401).json({ error: 'User no longer exists.' });
        }
        req.user = user;
      } else {
        // In-memory / Fallback user object if DB is offline
        req.user = { id: decoded.id, name: decoded.name || 'User', email: decoded.email || '' };
      }

      return next();
    } catch (error) {
      console.error('Auth verification failed:', error.message);
      return res.status(401).json({ error: 'Not authorized, token failed or expired.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided.' });
  }
};

// Optional Auth middleware (populates req.user if token present, but doesn't block guests)
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      if (getIsConnected()) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        req.user = { id: decoded.id, name: decoded.name || 'User', email: decoded.email || '' };
      }
    } catch (error) {
      // Token invalid/expired - clear user but allow request to proceed as guest
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};

module.exports = { generateToken, protect, optionalAuth, JWT_SECRET };
