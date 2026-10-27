import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import { getHealthLogsByUserId, getProgressLogsByUserId } from '../data/store.js';
import HealthLog from '../models/HealthLog.js';

const analyticsRouter = express.Router();

analyticsRouter.use(authenticateToken);

async function loadLogs(userId, from, to) {
  if (mongoose.connection.readyState === 1) {
    return HealthLog.find({ userId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
  }
  return getHealthLogsByUserId(userId).filter((log) => {
    const time = new Date(log.date).getTime();
    return time >= from.getTime() && time <= to.getTime();
  });
}

analyticsRouter.get('/summary', async (req, res, next) => {
  const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 7, 1), 90);
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);

  try {
    const logs = await loadLogs(req.user.id, start, end);
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = logs.find((log) => new Date(log.date).toISOString().slice(0, 10) === todayKey) || null;
    const average = (field) => {
      const available = logs.filter((item) => item[field] !== null && item[field] !== undefined);
      return available.length
        ? Number((available.reduce((sum, item) => sum + Number(item[field]), 0) / available.length).toFixed(1))
        : null;
    };

    return res.json({
      period: { days, from: start.toISOString(), to: end.toISOString() },
      today,
      records: logs,
      averages: { steps: average('steps'), sleep: average('sleep'), hydration: average('hydration'), activityMinutes: average('activityMinutes') },
      goals: { steps: 10000, sleep: 8, hydration: 2.5, activityMinutes: 30 },
      progress: getProgressLogsByUserId(req.user.id),
      hasData: logs.length > 0,
    });
  } catch (error) {
    return next(error);
  }
});

analyticsRouter.get('/reports/summary', async (req, res, next) => {
  const { from, to } = req.query;
  if (!from || !to || Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime()) || new Date(from) > new Date(to)) {
    return res.status(400).json({ message: 'A valid from and to date range is required.' });
  }

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  try {
    const logs = await loadLogs(req.user.id, start, end);
    const fields = ['steps', 'sleep', 'hydration', 'activityMinutes'];
    const totals = Object.fromEntries(fields.map((field) => [field, logs.reduce((sum, item) => sum + Number(item[field] || 0), 0)]));
    return res.json({ from: start.toISOString(), to: end.toISOString(), records: logs, totals, recordCount: logs.length, missingData: logs.length === 0 ? fields : [] });
  } catch (error) {
    return next(error);
  }
});

export default analyticsRouter;
