import express from 'express';
import mongoose from 'mongoose';
import HealthLog from '../models/HealthLog.js';
import Notification from '../models/Notification.js';
import {
  createHealthLog,
  createNotification,
  deleteHealthLog,
  getHealthLogsByUserId,
  updateHealthLog,
} from '../data/store.js';
import { authenticateToken } from '../middleware/auth.js';

const healthLogsRouter = express.Router();
const numericRanges = {
  steps: [0, 100000],
  sleep: [0, 24],
  hydration: [0, 20],
  activityMinutes: [0, 1440],
};

function validateLog(body) {
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? new Date(`${body.date}T00:00:00.000Z`)
    : null;

  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) {
    return 'A valid date in YYYY-MM-DD format is required.';
  }
  if (date.getTime() > new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).getTime()) {
    return 'Health log dates cannot be in the future.';
  }

  for (const [field, [minimum, maximum]] of Object.entries(numericRanges)) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '' && (!Number.isFinite(Number(body[field])) || Number(body[field]) < minimum || Number(body[field]) > maximum)) {
      return `${field} must be between ${minimum} and ${maximum}.`;
    }
  }
  if (!Object.keys(numericRanges).some((field) => body[field] !== undefined && body[field] !== null && body[field] !== '')) {
    return 'Enter at least one health metric before saving.';
  }

  if (body.activityType !== undefined && (typeof body.activityType !== 'string' || body.activityType.length > 60)) {
    return 'Activity type must be 60 characters or fewer.';
  }
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) {
    return 'Notes must be 500 characters or fewer.';
  }

  return null;
}

function normalizeLog(body) {
  return {
    date: new Date(`${body.date}T00:00:00.000Z`),
    steps: body.steps === undefined || body.steps === null || body.steps === '' ? null : Number(body.steps),
    sleep: body.sleep === undefined || body.sleep === null || body.sleep === '' ? null : Number(body.sleep),
    hydration: body.hydration === undefined || body.hydration === null || body.hydration === '' ? null : Number(body.hydration),
    activityType: body.activityType || 'Other',
    activityMinutes: body.activityMinutes === undefined || body.activityMinutes === null || body.activityMinutes === '' ? null : Number(body.activityMinutes),
    notes: body.notes || '',
  };
}

healthLogsRouter.use(authenticateToken);

healthLogsRouter.post('/', async (req, res, next) => {
  const validationError = validateLog(req.body || {});
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const payload = normalizeLog(req.body);
    const log = mongoose.connection.readyState === 1
      ? await HealthLog.findOneAndUpdate(
        { userId: req.user.id, date: payload.date },
        { $set: payload, $setOnInsert: { userId: req.user.id } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
      : createHealthLog(req.user.id, { ...payload, date: req.body.date });
    const notification = {
      userId: req.user.id,
      title: 'Wellness log saved',
      message: `Your activity for ${req.body.date} has been saved.`,
    };
    if (req.user.notificationsEnabled !== false && req.user.notificationPreferences?.inApp !== false) {
      if (mongoose.connection.readyState === 1) await Notification.create(notification);
      else createNotification(req.user.id, { title: notification.title, message: notification.message });
    }
    return res.status(201).json(log);
  } catch (error) {
    return next(error);
  }
});

healthLogsRouter.get('/', async (req, res, next) => {
  try {
    const { from, to, limit = '90', page = '1' } = req.query;
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 90, 1), 365);
    const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const start = from ? new Date(`${from}T00:00:00.000Z`) : null;
    const end = to ? new Date(`${to}T23:59:59.999Z`) : null;

    if ((from && Number.isNaN(start.getTime())) || (to && Number.isNaN(end.getTime()))) {
      return res.status(400).json({ message: 'Date filters must be valid dates.' });
    }

    let logs;
    if (mongoose.connection.readyState === 1) {
      const filter = { userId: req.user.id };
      if (start || end) filter.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
      logs = await HealthLog.find(filter).sort({ date: -1 }).skip((parsedPage - 1) * parsedLimit).limit(parsedLimit).lean();
    } else {
      logs = getHealthLogsByUserId(req.user.id).filter((log) => {
        const time = new Date(log.date).getTime();
        return (!start || time >= start.getTime()) && (!end || time <= end.getTime());
      }).reverse().slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);
    }

    return res.json({ items: logs, page: parsedPage, limit: parsedLimit });
  } catch (error) {
    return next(error);
  }
});

healthLogsRouter.put('/:id', async (req, res, next) => {
  const validationError = validateLog(req.body || {});
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const payload = normalizeLog(req.body);
    const log = mongoose.connection.readyState === 1
      ? await HealthLog.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: payload },
        { new: true, runValidators: true },
      )
      : updateHealthLog(req.user.id, req.params.id, { ...payload, date: req.body.date });
    if (log === false) return res.status(409).json({ message: 'A record already exists for that date. Edit that record instead.' });
    if (!log) return res.status(404).json({ message: 'Health log not found.' });
    return res.json(log);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A record already exists for that date. Edit that record instead.' });
    return next(error);
  }
});

healthLogsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = mongoose.connection.readyState === 1
      ? await HealthLog.findOneAndDelete({ _id: req.params.id, userId: req.user.id })
      : deleteHealthLog(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Health log not found.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default healthLogsRouter;
