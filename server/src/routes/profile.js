import express from 'express';
import mongoose from 'mongoose';
import { getProfileByUserId, upsertProfile } from '../data/store.js';
import { authenticateToken } from '../middleware/auth.js';
import HealthProfile from '../models/HealthProfile.js';

const profileRouter = express.Router();

profileRouter.use(authenticateToken);

profileRouter.get('/', async (req, res, next) => {
  try {
    const profile = mongoose.connection.readyState === 1
      ? await HealthProfile.findOne({ userId: req.user.id }).lean()
      : getProfileByUserId(req.user.id);
    return res.json(profile || null);
  } catch (error) {
    return next(error);
  }
});

profileRouter.put('/', async (req, res, next) => {
  const body = req.body || {};
  const fields = ['height', 'weight', 'sleepHours'];
  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== null && (Array.isArray(body[field]) || typeof body[field] === 'object' || !Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      return res.status(400).json({ message: `${field} must be a non-negative number.` });
    }
  }
  if (body.height > 250 || body.weight > 350 || body.sleepHours > 24) {
    return res.status(400).json({ message: 'One or more profile values are outside the allowed range.' });
  }
  if (body.ageRange && !['under-18', '18-24', '25-34', '35-44', '45-54', '55-64', '65-plus', 'prefer-not-to-say'].includes(body.ageRange)) {
    return res.status(400).json({ message: 'Select a valid age range.' });
  }
  if (body.activityLevel !== undefined && !['beginner', 'low', 'moderate', 'active', 'high'].includes(body.activityLevel)) {
    return res.status(400).json({ message: 'Select a valid activity level.' });
  }
  if (body.diet !== undefined && !['balanced', 'vegetarian', 'vegan', 'pescatarian', 'other'].includes(body.diet)) {
    return res.status(400).json({ message: 'Select a valid dietary preference.' });
  }
  if (body.goal !== undefined && (typeof body.goal !== 'string' || body.goal.length > 100)) {
    return res.status(400).json({ message: 'Goal must be 100 characters or fewer.' });
  }
  if (body.lifestyle !== undefined && (typeof body.lifestyle !== 'string' || body.lifestyle.length > 60)) {
    return res.status(400).json({ message: 'Lifestyle must be 60 characters or fewer.' });
  }
  for (const field of ['goals', 'wellnessGoals', 'dietaryPreferences']) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length > 20 || body[field].some((item) => typeof item !== 'string' || item.length > 100))) {
      return res.status(400).json({ message: `${field} must be a list of up to 20 short text values.` });
    }
  }

  const allowedFields = ['ageRange', 'height', 'weight', 'activityLevel', 'diet', 'goal', 'goals', 'dietaryPreferences', 'sleepHours', 'wellnessGoals', 'lifestyle'];
  const payload = Object.fromEntries(allowedFields.filter((field) => body[field] !== undefined).map((field) => [
    field,
    ['height', 'weight', 'sleepHours'].includes(field) && body[field] !== null ? Number(body[field]) : body[field],
  ]));

  try {
    const profile = mongoose.connection.readyState === 1
      ? await HealthProfile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: payload, $setOnInsert: { userId: req.user.id } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
      : upsertProfile(req.user.id, payload);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
});

export default profileRouter;
