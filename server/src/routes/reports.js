import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getHealthLogsByUserId } from '../data/store.js';
import mongoose from 'mongoose';
import HealthLog from '../models/HealthLog.js';

const reportsRouter = express.Router();
reportsRouter.use(authenticateToken);

reportsRouter.get('/summary', async (req, res, next) => {
  const { from, to } = req.query;
  if (!from || !to || Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime()) || new Date(from) > new Date(to)) {
    return res.status(400).json({ message: 'A valid from and to date range is required.' });
  }

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  try {
    const records = mongoose.connection.readyState === 1
      ? await HealthLog.find({ userId: req.user.id, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean()
      : getHealthLogsByUserId(req.user.id).filter((log) => new Date(log.date) >= start && new Date(log.date) <= end);
    const fields = ['steps', 'sleep', 'hydration', 'activityMinutes'];
    const totals = Object.fromEntries(fields.map((field) => {
      const available = records.filter((record) => record[field] !== null && record[field] !== undefined);
      return [field, available.length ? available.reduce((sum, record) => sum + Number(record[field]), 0) : null];
    }));
    const missingData = fields.filter((field) => totals[field] === null);
    return res.json({ from: start.toISOString(), to: end.toISOString(), records, totals, recordCount: records.length, missingData });
  } catch (error) {
    return next(error);
  }
});

export default reportsRouter;