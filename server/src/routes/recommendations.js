import express from 'express';
import mongoose from 'mongoose';
import { createRecommendation, getProfileByUserId, getRecommendationsByUserId, getHealthLogsByUserId, updateRecommendation } from '../data/store.js';
import { generateRecommendations } from '../utils/recommendations.js';
import { authenticateToken } from '../middleware/auth.js';
import HealthProfile from '../models/HealthProfile.js';
import HealthLog from '../models/HealthLog.js';
import Recommendation from '../models/Recommendation.js';

const recommendationsRouter = express.Router();

recommendationsRouter.use(authenticateToken);

recommendationsRouter.post('/generate', async (req, res, next) => {
  try {
    const [profile, latestLog] = mongoose.connection.readyState === 1
      ? await Promise.all([
        HealthProfile.findOne({ userId: req.user.id }).lean(),
        HealthLog.findOne({ userId: req.user.id }).sort({ date: -1 }).lean(),
      ])
      : [getProfileByUserId(req.user.id), getHealthLogsByUserId(req.user.id).at(-1)];
    const generated = generateRecommendations(profile || {}, { latestLog: latestLog || {} })
      .filter((item) => ['nutrition', 'activity', 'sleep', 'lifestyle'].includes(item.type));
    const saved = mongoose.connection.readyState === 1
      ? await Recommendation.insertMany(generated.map((item) => ({ ...item, userId: req.user.id })))
      : generated.map((item) => createRecommendation(req.user.id, item));
    return res.status(201).json(saved);
  } catch (error) {
    return next(error);
  }
});

recommendationsRouter.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user.id, status: { $ne: 'dismissed' }, ...(req.query.category ? { type: req.query.category } : {}) };
    const items = mongoose.connection.readyState === 1
      ? await Recommendation.find(filter).sort({ createdAt: -1 }).limit(100).lean()
      : getRecommendationsByUserId(req.user.id).filter((item) => !req.query.category || item.type === req.query.category);
    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

recommendationsRouter.patch('/:id/feedback', async (req, res, next) => {
  const { feedback, status } = req.body || {};
  if ((feedback !== undefined && !['helpful', 'not-helpful', null].includes(feedback)) || (status !== undefined && !['active', 'dismissed'].includes(status))) {
    return res.status(400).json({ message: 'Feedback or status value is invalid.' });
  }

  try {
    const patch = Object.fromEntries(['feedback', 'status'].filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const recommendation = mongoose.connection.readyState === 1
      ? await Recommendation.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: patch }, { new: true, runValidators: true })
      : updateRecommendation(req.user.id, req.params.id, patch);
    if (!recommendation) return res.status(404).json({ message: 'Recommendation not found.' });
    return res.json(recommendation);
  } catch (error) {
    return next(error);
  }
});

export default recommendationsRouter;
