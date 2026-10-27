import jwt from 'jsonwebtoken';
import { findUserById } from '../data/store.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token missing.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'healthmate-local-development-only');
    const user = mongoose.connection.readyState === 1
      ? await User.findById(payload.userId).select('-passwordHash')
      : findUserById(payload.userId);

    if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;
    req.user = user;
    return next();
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}
