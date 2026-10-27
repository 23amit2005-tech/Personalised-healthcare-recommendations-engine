import express from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { store } from '../data/store.js';
import { authenticateToken } from '../middleware/auth.js';

const notificationsRouter = express.Router();
notificationsRouter.use(authenticateToken);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const items = mongoose.connection.readyState === 1
      ? await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean()
      : store.notifications.filter((item) => item.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    return res.json({ items, unreadCount: items.filter((item) => !item.readAt).length });
  } catch (error) {
    return next(error);
  }
});

notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    let notification;
    if (mongoose.connection.readyState === 1) {
      notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: { readAt: new Date() } },
        { new: true },
      );
    } else {
      notification = store.notifications.find((item) => item.userId === req.user.id && item.id === req.params.id);
      if (notification) notification.readAt = new Date().toISOString();
    }
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.json(notification);
  } catch (error) {
    return next(error);
  }
});

export default notificationsRouter;