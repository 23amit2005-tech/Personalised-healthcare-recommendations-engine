import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { findUserByEmail, createUserRecord } from '../data/store.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const authRouter = express.Router();

const sanitizeUser = (user) => ({
  id: user.id || user._id?.toString(),
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  createdAt: user.createdAt,
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const jwtSecret = () => process.env.JWT_SECRET || 'healthmate-local-development-only';

authRouter.post('/register', authLimiter, async (req, res, next) => {
  const { name, email, password } = req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Enter a valid name and email, and a password between 8 and 128 characters.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = mongoose.connection.readyState === 1
      ? await User.findOne({ email: normalizedEmail })
      : findUserByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'User with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = mongoose.connection.readyState === 1
      ? await User.create({ name: name.trim(), email: normalizedEmail, passwordHash })
      : createUserRecord({ name: name.trim(), email: normalizedEmail, passwordHash, role: 'user' });
    const token = jwt.sign({ userId: user.id || user._id.toString(), tokenVersion: user.tokenVersion ?? 0 }, jwtSecret(), { expiresIn: '7d' });
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'User with this email already exists.' });
    return next(error);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = mongoose.connection.readyState === 1
      ? await User.findOne({ email: normalizedEmail })
      : findUserByEmail(normalizedEmail);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id || user._id.toString(), tokenVersion: user.tokenVersion ?? 0 }, jwtSecret(), { expiresIn: '7d' });
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    } else {
      req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    }
    return res.status(200).json({ message: 'Logged out.' });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', authenticateToken, (req, res) => res.json({ user: sanitizeUser(req.user) }));

export default authRouter;
