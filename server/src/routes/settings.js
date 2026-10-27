import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import { store } from '../data/store.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import HealthLog from '../models/HealthLog.js';
import Recommendation from '../models/Recommendation.js';
import Notification from '../models/Notification.js';
import ProgressLog from '../models/ProgressLog.js';

const settingsRouter = express.Router();
settingsRouter.use(authenticateToken);

settingsRouter.get('/preferences', (req, res) => {
  return res.json({
    notificationsEnabled: req.user.notificationsEnabled ?? true,
    notificationPreferences: req.user.notificationPreferences || { email: false, inApp: true },
  });
});

settingsRouter.patch('/preferences', async (req, res, next) => {
  const { notificationsEnabled, notificationPreferences } = req.body || {};
  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    return res.status(400).json({ message: 'notificationsEnabled must be a boolean.' });
  }
  if (notificationPreferences !== undefined && (!notificationPreferences || typeof notificationPreferences !== 'object' || Array.isArray(notificationPreferences))) {
    return res.status(400).json({ message: 'Notification preferences must be an object.' });
  }

  try {
    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findByIdAndUpdate(req.user.id, { $set: {
        ...(notificationsEnabled !== undefined ? { notificationsEnabled } : {}),
        ...(notificationPreferences ? { notificationPreferences } : {}),
      } }, { new: true, runValidators: true }).select('-passwordHash');
    } else {
      user = req.user;
      if (notificationsEnabled !== undefined) user.notificationsEnabled = notificationsEnabled;
      if (notificationPreferences) user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }
    return res.json({ notificationsEnabled: user.notificationsEnabled ?? true, notificationPreferences: user.notificationPreferences || { email: false, inApp: true } });
  } catch (error) {
    return next(error);
  }
});

settingsRouter.put('/password', async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'Current password and a new password of 8 to 128 characters are required.' });
  }

  try {
    const user = mongoose.connection.readyState === 1 ? await User.findById(req.user.id) : req.user;
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    if (user.save) await user.save();
    const token = jwt.sign(
      { userId: user.id || user._id.toString(), tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET || 'healthmate-local-development-only',
      { expiresIn: '7d' },
    );
    return res.json({ message: 'Password updated.', token });
  } catch (error) {
    return next(error);
  }
});

settingsRouter.get('/export', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, healthLogs, recommendations, notifications, progressLogs] = mongoose.connection.readyState === 1
      ? await Promise.all([
        HealthProfile.findOne({ userId }).lean(),
        HealthLog.find({ userId }).sort({ date: 1 }).lean(),
        Recommendation.find({ userId }).sort({ createdAt: -1 }).lean(),
        Notification.find({ userId }).sort({ createdAt: -1 }).lean(),
        ProgressLog.find({ userId }).sort({ createdAt: -1 }).lean(),
      ])
      : [
        store.profiles.find((item) => item.userId === userId) || null,
        store.healthLogs.filter((item) => item.userId === userId),
        store.recommendations.filter((item) => item.userId === userId),
        store.notifications.filter((item) => item.userId === userId),
        store.progressLogs.filter((item) => item.userId === userId),
      ];
    return res.json({ exportedAt: new Date().toISOString(), user: { id: req.user.id, name: req.user.name, email: req.user.email, createdAt: req.user.createdAt }, profile, healthLogs, recommendations, notifications, progressLogs });
  } catch (error) {
    return next(error);
  }
});

settingsRouter.delete('/account', async (req, res, next) => {
  const { password } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ message: 'Password confirmation is required.' });

  try {
    const user = mongoose.connection.readyState === 1 ? await User.findById(req.user.id) : req.user;
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Password confirmation failed.' });
    }

    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        HealthProfile.deleteMany({ userId: req.user.id }),
        HealthLog.deleteMany({ userId: req.user.id }),
        Recommendation.deleteMany({ userId: req.user.id }),
        Notification.deleteMany({ userId: req.user.id }),
        ProgressLog.deleteMany({ userId: req.user.id }),
        User.deleteOne({ _id: req.user.id }),
      ]);
    } else {
      for (const collection of Object.values(store)) {
        if (Array.isArray(collection)) {
          const userIndex = collection.findIndex((item) => item.id === req.user.id);
          for (let index = collection.length - 1; index >= 0; index -= 1) {
            if (collection[index].userId === req.user.id) collection.splice(index, 1);
          }
          if (collection === store.users && userIndex >= 0) collection.splice(userIndex, 1);
        }
      }
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default settingsRouter;