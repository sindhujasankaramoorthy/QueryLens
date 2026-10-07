const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const { getIsConnected } = require('../config/db');

// In-memory fallback store when MongoDB is offline
const inMemoryUsers = new Map();

// Seed a default demo user for instant login
(async () => {
  const bcrypt = require('bcryptjs');
  const demoHashed = await bcrypt.hash('password123', 10);
  inMemoryUsers.set('demo@querylens.ai', {
    id: 'demo_user_1',
    name: 'Demo Analyst',
    email: 'demo@querylens.ai',
    password: demoHashed,
  });
})();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user & return JWT token
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (getIsConnected()) {
      // MongoDB persistent user registration
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
      });

      const token = generateToken(user._id, { name: user.name, email: user.email });

      return res.status(201).json({
        message: 'Registration successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } else {
      // In-memory fallback mode
      if (inMemoryUsers.has(normalizedEmail)) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const fakeId = 'mem_' + Date.now();

      const memoryUser = {
        id: fakeId,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      };

      inMemoryUsers.set(normalizedEmail, memoryUser);
      const token = generateToken(fakeId, { name: memoryUser.name, email: memoryUser.email });

      return res.status(201).json({
        message: 'Registration successful (In-Memory Mode)',
        token,
        user: {
          id: memoryUser.id,
          name: memoryUser.name,
          email: memoryUser.email,
        },
      });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ error: error.message || 'Server error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (getIsConnected()) {
      // MongoDB authentication
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user._id, { name: user.name, email: user.email });

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } else {
      // In-memory fallback authentication
      const user = inMemoryUsers.get(normalizedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user.id, { name: user.name, email: user.email });

      return res.json({
        message: 'Login successful (In-Memory Mode)',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    }
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: error.message || 'Server error during login.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (JWT protected)
 */
router.get('/me', protect, async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user._id || req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching user profile.' });
  }
});

module.exports = router;
